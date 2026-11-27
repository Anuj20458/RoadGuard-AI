import mongoose from "mongoose";

/**
 * Checks whether a Mongoose/MongoDB error indicates that multi-document
 * transactions are unsupported by the connected topology (e.g. standalone node).
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isTransactionUnsupportedError(error) {
  const err = /** @type {{ code?: number, codeName?: string, message?: string }} */ (
    error
  );
  if (err?.code === 20 || err?.codeName === "IllegalOperation") {
    return true;
  }
  const message = typeof err?.message === "string" ? err.message : "";
  return /Transaction numbers are only allowed|replica set/i.test(message);
}

/**
 * Executes a multi-document write callback inside a MongoDB transaction when
 * supported by the cluster, falling back to non-transactional execution on
 * standalone topologies.
 *
 * @template T
 * @param {(session: import("mongoose").ClientSession | null) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function withOptionalTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupportedError(error)) {
      throw error;
    }
    return callback(null);
  } finally {
    await session.endSession();
  }
}
