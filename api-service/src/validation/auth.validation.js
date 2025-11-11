import { body } from "express-validator";

// Auth validation middleware
export const validateRegister = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    ),
];

export const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const validateProfileUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
];

export const validatePasswordChange = [
  body("oldPassword").notEmpty().withMessage("Old password is required"),
  body("newPassword")
    .isLength({ min: 8, max: 128 })
    .withMessage("New password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    ),
];

export const validateAccountDeletion = [
  body("password")
    .notEmpty()
    .withMessage("Password is required to delete account"),
];

export const validateUserStatusUpdate = [
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  body("role")
    .optional()
    .isIn(["admin", "customer"])
    .withMessage("Role must be either 'admin' or 'customer'"),
];

// Query validation for pagination and filtering
export const validateUserQuery = [
  body("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  body("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),
  body("role")
    .optional()
    .isIn(["admin", "customer"])
    .withMessage("Role filter must be either 'admin' or 'customer'"),
];

// Refresh token validation
export const validateRefreshToken = [
  body("refreshToken")
    .optional()
    .notEmpty()
    .withMessage("Refresh token is required"),
];
