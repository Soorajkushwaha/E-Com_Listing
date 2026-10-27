# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity & Admin Bootstrapping**:
   - Standard writes require `request.auth != null && request.auth.token.email_verified == true`.
   - Administrator privileges (`isAdmin()`) require a verified user whose UID exists in `/admins/$(request.auth.uid)` OR whose verified email matches the bootstrapped application owner (`simple.sooraj@gmail.com`).
3. **Path Variable Hardening**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates its path ID with `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Strict Key & Volumetric Validation (`isValid[Entity]`)**:
   - All `create` and `update` blocks invoke the entity's `isValid[Entity](incoming())` blueprint helper first.
   - `hasAll` and `hasOnly` enforce exact required and allowed field sets so shadow/ghost fields are rejected.
   - Every string field enforces explicit `.size()` bounds matching `firebase-blueprint.json`.
5. **Temporal & Identity Immutability**:
   - `createdAt == request.time` on `create`; `createdAt == existing().createdAt` and `updatedAt == request.time` on `update`.
   - `ownerId == request.auth.uid` on `create`; `ownerId == existing().ownerId` on `update`.
6. **PII Isolation & Query Enforcer**:
   - `bulkOrders` contains customer PII (`mobile`, `whatsapp`, `email`, `address`). `get` and `list` are strictly restricted to `resource.data.ownerId == request.auth.uid || isAdmin()`. Public visitors or other signed-in users cannot read or list another customer's orders.
   - Public catalog collections (`products`, `campaigns`, `themes`) enforce `resource.data.status == 'active'` (or `resource.data.isPublic == true`) on `list` and `get` for non-admins.
7. **Terminal State Locking**:
   - Non-admin users cannot update a `BulkOrder` once `existing().status in ['Delivered', 'Cancelled', 'Rejected']`. Admins have an explicit `|| isAdmin()` override when accompanied by `isValidBulkOrder(incoming())`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Product Create**: Adding `"isSuperFeatured": true` to `/products/prod-1` -> Rejected by `hasOnly`.
2. **Email Spoofing Attack**: `request.auth.token.email == "simple.sooraj@gmail.com"` with `email_verified == false` -> Rejected by `isVerifiedUser()`.
3. **ID Poisoning Attack**: Document ID containing spaces or >128 chars -> Rejected by `isValidId()`.
4. **PII Blanket Read on BulkOrders**: Authenticated non-owner attempting `get` or `list` on `/bulkOrders/ord-1` where `ownerId != request.auth.uid` -> Rejected.
5. **Identity Spoofing on BulkOrder Create**: Authenticated user setting `ownerId: "victim-uid"` -> Rejected by `incoming().ownerId == request.auth.uid`.
6. **Timestamp Forgery on Create**: Client sending a past or future `createdAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
7. **Immortal Field Mutation on Update**: Changing `createdAt` or `ownerId` during `update` -> Rejected by immutability gate.
8. **Value Poisoning on Update**: Updating `sellingPrice` on `/products/prod-1` with a negative number or string -> Rejected by `isValidProduct(incoming())`.
9. **Denial-of-Wallet Oversized String**: Sending a 50,000-character string in `description` -> Rejected by `data.description.size() <= 2000`.
10. **Terminal State Modification by Non-Admin**: Customer attempting to update a `Delivered` order -> Rejected by terminal state lock.
11. **Unverified User Write**: Authenticated user with `email_verified: false` attempting to create a `BulkOrder` -> Rejected.
12. **Self-Assigned Admin Escalation**: Non-admin attempting to create `/admins/their-uid` -> Rejected by `isAdmin()` check on `/admins/{adminId}`.
