/**
 * Base class for business errors raised by the domain and application layers.
 *
 * Deliberately framework-agnostic: translation into an HTTP response is the
 * responsibility of the presentation layer (see `AllExceptionsFilter`).
 */
export abstract class DomainException extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a requested entity does not exist. Translated to HTTP 404. */
export abstract class EntityNotFoundException extends DomainException {}
