# Strapi v5 Validation Improvements Documentation

## Overview

This document outlines the validation issues identified in the current Strapi v5 application and provides specific recommendations for improvement.

## Current State Analysis

### Issues Identified

#### 1. **Schema Validation Problems**

- **Issue**: Inconsistent validation rules between schema and controller logic
- **Location**: `src/api/student/content-types/student/schema.json`
- **Problem**:
  - `email` field marked as `required: false` but controller treats it as required
  - Missing `required: true` on critical fields (`name`, `phone`, `dob`, `school_name`, `grade`, `section`, `city`)
  - No validation constraints (minLength, maxLength, pattern)

#### 2. **Manual Validation Anti-Pattern**

- **Issue**: Bypassing Strapi's built-in validation system
- **Location**: `src/api/v1/controllers/v1.ts` (lines 27-35)
- **Problem**: Manual field checking instead of leveraging Strapi's automatic validation

#### 3. **Weak Input Validation**

- **Issue**: Insufficient data validation
- **Problems**:
  - No email format validation beyond basic existence check
  - No phone number format validation
  - No date format validation for `dob`
  - No length constraints on string fields
  - No input sanitization

#### 4. **Security Concerns**

- **Issues**:
  - No input sanitization
  - Generic error messages that could leak information
  - Missing CSRF protection considerations

#### 5. **Type Safety Issues**

- **Issues**:
  - Missing TypeScript interfaces for request/response validation
  - Using `any` types in several places
  - No runtime type checking

## Recommended Changes

### 1. Fix Schema Validation

**File**: `src/api/student/content-types/student/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "students",
  "info": {
    "singularName": "student",
    "pluralName": "students",
    "displayName": "student"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "minLength": 2,
      "maxLength": 100
    },
    "email": {
      "type": "email",
      "required": true,
      "unique": true
    },
    "phone": {
      "type": "string",
      "required": true,
      "pattern": "^[0-9]{10}$"
    },
    "dob": {
      "type": "date",
      "required": true
    },
    "school_name": {
      "type": "string",
      "required": true,
      "minLength": 2,
      "maxLength": 200
    },
    "grade": {
      "type": "string",
      "required": true,
      "minLength": 1,
      "maxLength": 10
    },
    "section": {
      "type": "string",
      "required": true,
      "minLength": 1,
      "maxLength": 10
    },
    "city": {
      "type": "string",
      "required": true,
      "minLength": 2,
      "maxLength": 100
    },
    "mail_sent": {
      "type": "boolean",
      "default": false
    },
    "wa_sent": {
      "type": "boolean",
      "default": false
    },
    "payment_id": {
      "type": "string"
    },
    "school": {
      "type": "relation",
      "relation": "oneToOne",
      "target": "api::school.school"
    },
    "is_overseas": {
      "type": "boolean",
      "default": false
    },
    "payment_status": {
      "type": "enumeration",
      "default": "pending",
      "enum": ["pending", "completed", "failed"]
    },
    "selected_addon": {
      "type": "json"
    },
    "order_amount": {
      "type": "biginteger"
    },
    "order_currency": {
      "type": "string",
      "enum": ["INR", "USD"]
    },
    "razorpay_order_id": {
      "type": "string"
    },
    "payment_verified_at": {
      "type": "datetime"
    },
    "payment_method": {
      "type": "string"
    },
    "payment_captured_at": {
      "type": "datetime"
    }
  }
}
```

### 2. Remove Manual Validation from Controller

**File**: `src/api/v1/controllers/v1.ts`

**Remove these lines (27-35):**

```typescript
// Basic validation: check if data exists and required fields are present
if (!data) {
  ctx.throw(400, "Missing data in request body");
}
const requiredFields = [
  "name",
  "email",
  "phone",
  "dob",
  "school_name",
  "grade",
  "section",
  "city",
];
const missingFields = requiredFields.filter(
  (field) =>
    !data.hasOwnProperty(field) ||
    data[field] === undefined ||
    data[field] === null ||
    data[field] === ""
);
if (missingFields.length > 0) {
  ctx.throw(400, `Missing required fields: ${missingFields.join(", ")}`);
}
```

**Replace with:**

```typescript
// Let Strapi handle validation automatically
if (!data) {
  ctx.throw(400, "Missing data in request body");
}
```

### 3. Add TypeScript Interfaces

**Create new file**: `src/api/v1/types/validation.ts`

```typescript
export interface StudentRegistrationData {
  name: string;
  email: string;
  phone: string;
  dob: string;
  school_name: string;
  grade: string;
  section: string;
  city: string;
  is_overseas?: boolean;
}

export interface AddonData {
  id: string;
  title: string;
  originalPrice: number;
  originalPriceInr: number;
}

export interface RegistrationRequest {
  data: StudentRegistrationData;
  selectedAddon?: AddonData;
  registrationFee: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### 4. Add Custom Validation Middleware

**Create new file**: `src/api/v1/middlewares/validation.ts`

```typescript
import { ValidationError } from "../types/validation";

export const validateRegistrationData = async (ctx, next) => {
  const { data } = ctx.request.body;

  if (!data) {
    ctx.throw(400, "Missing data in request body");
  }

  // Additional business logic validation
  const errors: ValidationError[] = [];

  // Email domain validation for staff registration
  if (data.email && data.email.includes("@spacetopia.in")) {
    // Additional staff-specific validation if needed
  }

  // Phone number format validation (if not handled by schema)
  if (data.phone && !/^[0-9]{10}$/.test(data.phone)) {
    errors.push({
      field: "phone",
      message: "Phone number must be exactly 10 digits",
      code: "INVALID_PHONE_FORMAT",
    });
  }

  // Date of birth validation
  if (data.dob) {
    const dobDate = new Date(data.dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();

    if (age < 5 || age > 18) {
      errors.push({
        field: "dob",
        message: "Student age must be between 5 and 18 years",
        code: "INVALID_AGE",
      });
    }
  }

  if (errors.length > 0) {
    ctx.throw(400, {
      message: "Validation failed",
      errors,
    });
  }

  await next();
};
```

### 5. Update Controller with Better Error Handling

**File**: `src/api/v1/controllers/v1.ts`

```typescript
import { RegistrationRequest } from "../types/validation";

export default factories.createCoreController("api::v1.v1", ({ strapi }) => ({
  async saveDraftAndCreateOrder(ctx) {
    try {
      const { data, selectedAddon, registrationFee }: RegistrationRequest =
        ctx.request.body;

      // Strapi will handle basic validation automatically
      if (!data) {
        ctx.throw(400, "Missing data in request body");
      }

      const isStaffRegistration = data.email.includes("@spacetopia.in");

      // Rest of the existing logic...
    } catch (err) {
      console.error("Registration error:", err);

      // Better error handling
      if (err.status) {
        ctx.throw(err.status, err.message);
      }

      // Handle validation errors specifically
      if (err.name === "ValidationError") {
        ctx.throw(400, {
          message: "Validation failed",
          details: err.details,
        });
      }

      ctx.throw(500, "An error occurred while processing the registration");
    }
  },

  // ... rest of the methods
}));
```

### 6. Add Input Sanitization

**Create new file**: `src/api/v1/utils/sanitization.ts`

```typescript
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/[&<>"']/g, (match) => {
      const escapeMap: { [key: string]: string } = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      };
      return escapeMap[match];
    });
}

export function sanitizeRegistrationData(data: any) {
  return {
    ...data,
    name: sanitizeString(data.name),
    email: sanitizeString(data.email).toLowerCase(),
    phone: sanitizeString(data.phone),
    school_name: sanitizeString(data.school_name),
    grade: sanitizeString(data.grade),
    section: sanitizeString(data.section),
    city: sanitizeString(data.city),
  };
}
```

## Critical Fix Applied

### **Document Publishing Issue Fixed**

**Problem**: The application was experiencing errors when sending email and WhatsApp notifications due to attempting to publish already published documents in Strapi v5.

**Error**: `ApplicationError: A published entry with documentId "..." already exists for UID "api::student.student". This combination must be unique.`

**Solution Applied**:

- Removed duplicate `publish()` calls in the notification background process
- Fixed the webhook handler to only publish once after payment completion
- Added better error handling and debugging for notification services

**Files Modified**:

- `src/api/v1/controllers/v1.ts` - Fixed document publishing logic
- `src/api/v1/utils/notifications.ts` - Added debugging and auth token validation

## Implementation Steps

1. **Update Schema** - Apply the improved schema validation rules
2. **Remove Manual Validation** - Clean up the controller validation code
3. **Add TypeScript Interfaces** - Create proper type definitions
4. **Implement Custom Middleware** - Add business logic validation
5. **Add Input Sanitization** - Implement security measures
6. **Update Error Handling** - Improve error responses
7. **Fix Document Publishing** - ✅ **COMPLETED** - Fixed duplicate publishing issue
8. **Test Thoroughly** - Verify all validation works correctly

## Benefits of These Changes

- ✅ **Consistent Validation**: Schema and controller validation aligned
- ✅ **Better Security**: Input sanitization and proper validation
- ✅ **Type Safety**: Strong TypeScript interfaces
- ✅ **Maintainability**: Cleaner, more maintainable code
- ✅ **User Experience**: Better error messages and validation feedback
- ✅ **Strapi Best Practices**: Following framework conventions

## Testing Checklist

- [ ] Test with missing required fields
- [ ] Test with invalid email formats
- [ ] Test with invalid phone numbers
- [ ] Test with invalid date formats
- [ ] Test with malicious input (XSS attempts)
- [ ] Test edge cases (very long strings, special characters)
- [ ] Verify error messages are user-friendly
- [ ] Test staff registration flow
- [ ] Test overseas registration flow

---

**Note**: After implementing these changes, remember to restart your Strapi development server to ensure all schema changes are applied correctly.
