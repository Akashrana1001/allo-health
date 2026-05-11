export type ErrorCode =
  | "NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "RESERVATION_EXPIRED"
  | "ALREADY_CONFIRMED"
  | "ALREADY_RELEASED"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: ErrorCode
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class InsufficientStockError extends AppError {
  constructor(message = "Not enough stock available") {
    super(message, 409, "INSUFFICIENT_STOCK");
  }
}

export class ReservationExpiredError extends AppError {
  constructor(message = "Reservation has expired") {
    super(message, 410, "RESERVATION_EXPIRED");
  }
}

export class AlreadyConfirmedError extends AppError {
  constructor(message = "Reservation is already confirmed") {
    super(message, 409, "ALREADY_CONFIRMED");
  }
}

export class AlreadyReleasedError extends AppError {
  constructor(message = "Reservation is already released") {
    super(message, 409, "ALREADY_RELEASED");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request body") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}
