/**
 * Guest mode constants.
 *
 * A guest's local data (captures) is stored in SQLite under this sentinel
 * user id. When the guest creates an account, the rows are bulk-imported
 * server-side via POST /account/claim and the local rows are deleted —
 * see claimGuestCaptures() in services/sync.ts.
 *
 * 0 can never collide with a real account: Postgres SERIAL ids start at 1.
 */
export const GUEST_USER_ID = 0;
