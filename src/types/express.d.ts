declare namespace Express {
  interface Request {
    /** Raw request body buffer captured before JSON parsing, used for HMAC signature verification. */
    rawBody?: Buffer;
  }
}
