# Security Specification & Payload-First Verification

## 1. Data Invariants
1. **Classroom Integrity**: Only verified admins can create, modify, or delete classrooms under `/classrooms/{roomId}`. Every classroom must have a bounded equipment list (`1..10` items), valid integer capacity (`1..500`), valid status (`available` or `maintenance`), and server-verified `createdAt`/`updatedAt` timestamps.
2. **Booking Referential Integrity**: Every booking under `/bookings/{bookingId}` must reference an existing classroom (`exists(/databases/$(database)/documents/classrooms/$(incoming().roomId))`), have valid ISO date (`YYYY-MM-DD`) and 24-hour times (`HH:MM`) where `startTime < endTime`, and must not contain any PII (`email`, `phone`, `address`).
3. **Booking Identity & Workflow**: Non-admin verified users may only create bookings with `creatorId == request.auth.uid` and `status == 'pending'`. They can only edit their own `'pending'` bookings or cancel their own non-cancelled bookings. Once `'cancelled'`, non-admins cannot mutate the booking. Admins may confirm, cancel, edit, or delete any booking.
4. **PII Isolation**: User emails and profile PII live strictly in `/users/{userId}/private/info`, accessible only to the owning user or an admin. Users cannot self-assign `role: 'admin'`.
5. **No Open List Scraping**: Every `allow list` clause evaluates `resource.data` directly without performing `get()` or `exists()` lookups.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Classroom Read**: Unauthenticated `get` / `list` on `/classrooms`.
2. **Non-Admin Classroom Create**: Coordinator attempts `setDoc('/classrooms/room-x', validClassroom)`.
3. **Spoofed Booking Creator**: User A creates booking with `creatorId: 'user-B'`.
4. **Privilege Self-Promotion on Booking**: Non-admin creates booking with `status: 'confirmed'`.
5. **Orphaned Room Reference**: User creates booking referencing non-existent `roomId: 'ghost-room'`.
6. **Shadow Ghost Field Injection**: User creates or updates booking with extra field `isApprovedOverride: true`.
7. **Reversed Time Range**: User creates booking with `startTime: '14:00'`, `endTime: '12:00'`.
8. **Client-Spoofed Timestamp**: User creates booking with client timestamp instead of `request.time`.
9. **ID Poisoning**: User attempts write to `/bookings/` with 1500-char or invalid-char document ID (`../admin`).
10. **Terminal State Mutation**: Non-admin attempts to update a `'cancelled'` booking back to `'pending'`.
11. **Self-Assigned Admin Role**: User creates `/users/{uid}/private/info` with `role: 'admin'`.
12. **PII Cross-User Read / Unverified Email Spoof**: User A reads `/users/{userB}/private/info`, or unverified token matching admin email attempts admin write.
