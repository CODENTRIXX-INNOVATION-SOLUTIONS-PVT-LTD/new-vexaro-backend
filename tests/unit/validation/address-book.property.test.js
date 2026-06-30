'use strict';

/**
 * Address Book — Property-Based Tests (Task 10)
 *
 * Uses fast-check to test validation schemas against random inputs,
 * verifying that our Zod schemas accept exactly the values they should
 * and reject all invalid ones — without relying on hand-picked examples.
 *
 * Key validator facts (from actual validator implementations):
 *  - Phone:   /^[6-9]\d{9}$/ BUT cleanPhoneNumber transforms certain patterns
 *             (e.g. 91XXXXXXX → +91...) so some valid-looking numbers get
 *             re-routed via international validation. We use known-safe generators.
 *  - Pincode: /^[1-9]\d{5}$/ — first digit CANNOT be 0. "000000" is rejected.
 *  - Email:   RFC5322 + TLD 2-6 alpha chars + no dangerous domain patterns
 *             (blocks /^test/i, /^spam/i, /^fake/i, /^noreply/i etc.)
 *  - State/City trim: Zod .trim() runs BEFORE .max(), so whitespace-padded strings
 *             that trim down to ≤50 chars will PASS even if raw length > 50.
 */

const fc = require('fast-check');

const {
  createAddressSchema,
  updateAddressSchema,
  listAddressQuerySchema,
  addressIdParamsSchema,
} = require('../../../src/validation/schemas/users/address-book.schemas');

// ─── Helpers ───────────────────────────────────────────────────────────────────

const parse = async (schema, value) => schema.safeParseAsync(value);

/** Build a valid base DTO — all fields guaranteed to pass real validators */
const validBase = () => ({
  name:        'John Doe',
  phone:       '9876543210',
  email:       'john@acme.co',      // 'acme.co' passes all domain checks
  addressLine: '123 Main Street',
  city:        'Mumbai',
  state:       'Maharashtra',
  pincode:     '400001',
  country:     'India',
  label:       'Store',
});

// ─── Phone number validation ───────────────────────────────────────────────────

describe('phone number — property-based', () => {
  /**
   * Safe Indian mobile generator:
   *  - First digit: 6, 7, 8 only (avoids 9 since "91XXXXXXX" gets re-routed
   *    through international validation by cleanPhoneNumber)
   *  - Remaining 9 digits: any digit
   */
  const safeIndianPhone = fc.integer({ min: 6, max: 8 }).chain((first) =>
    fc.stringMatching(/^\d{9}$/).map((rest) => `${first}${rest}`)
  );

  /** Phones starting 9 followed by 0 or 1 MAY be cleaned as international */
  const clearlyInvalidPhone = fc.integer({ min: 0, max: 5 }).chain((first) =>
    fc.stringMatching(/^\d{9}$/).map((rest) => `${first}${rest}`)
  );

  test('accepts phones starting with 6, 7, or 8 (safe range)', async () => {
    await fc.assert(
      fc.asyncProperty(safeIndianPhone, async (phone) => {
        const result = await parse(createAddressSchema, { ...validBase(), phone });
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  test('rejects phones not starting with 6–9 (starting with 0–5)', async () => {
    await fc.assert(
      fc.asyncProperty(clearlyInvalidPhone, async (phone) => {
        const result = await parse(createAddressSchema, { ...validBase(), phone });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('rejects phones shorter than 10 digits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 6, max: 8 }).chain((first) =>
          fc.integer({ min: 0, max: 8 }).chain((len) =>
            fc.stringMatching(new RegExp(`^\\d{${len}}$`)).map((rest) => `${first}${rest}`)
          )
        ),
        async (phone) => {
          const result = await parse(createAddressSchema, { ...validBase(), phone });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects phones longer than 10 digits (starting 6–8)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 6, max: 8 }).chain((first) =>
          fc.integer({ min: 10, max: 20 }).chain((extraLen) =>
            fc.stringMatching(new RegExp(`^\\d{${extraLen}}$`)).map((rest) => `${first}${rest}`)
          )
        ),
        async (phone) => {
          const result = await parse(createAddressSchema, { ...validBase(), phone });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects phones containing non-digit characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 10-char string starting with 6–8, with one letter in the middle
        fc.integer({ min: 6, max: 8 }).chain((first) =>
          fc.stringMatching(/^\d{4}[a-zA-Z]\d{4}$/).map((mid) => `${first}${mid}`)
        ),
        async (phone) => {
          const result = await parse(createAddressSchema, { ...validBase(), phone });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Pincode validation ────────────────────────────────────────────────────────

describe('pincode — property-based', () => {
  /**
   * Valid pincode: /^[1-9]\d{5}$/ — first digit MUST be 1–9.
   */
  const validPincode = fc.integer({ min: 1, max: 9 }).chain((first) =>
    fc.stringMatching(/^\d{5}$/).map((rest) => `${first}${rest}`)
  );

  test('accepts 6-digit pincodes starting with 1–9', async () => {
    await fc.assert(
      fc.asyncProperty(validPincode, async (pincode) => {
        const result = await parse(createAddressSchema, { ...validBase(), pincode });
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  test('rejects pincodes starting with 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^0\d{5}$/),
        async (pincode) => {
          const result = await parse(createAddressSchema, { ...validBase(), pincode });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects pincodes shorter than 6 digits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }).chain((len) =>
          fc.stringMatching(new RegExp(`^[1-9]\\d{${len - 1}}$`))
        ),
        async (pincode) => {
          const result = await parse(createAddressSchema, { ...validBase(), pincode });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects pincodes longer than 6 digits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 7, max: 12 }).chain((len) =>
          fc.stringMatching(new RegExp(`^[1-9]\\d{${len - 1}}$`))
        ),
        async (pincode) => {
          const result = await parse(createAddressSchema, { ...validBase(), pincode });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Email validation ──────────────────────────────────────────────────────────

describe('email — property-based', () => {
  /**
   * Safe email generator:
   * - local part: alphanumeric + dots/underscores/hyphens (avoids special RFC chars)
   * - domain: alphanumeric label
   * - TLD: 2–6 lowercase alpha chars (must pass TLD_PATTERN = /^[a-zA-Z]{2,6}$/)
   * - Avoids domain patterns blocked by DANGEROUS_DOMAIN_PATTERNS:
   *   /^temp.*mail/i, /^fake/i, /^test/i, /^spam/i, /^anonymous/i, /^noreply/i
   * - Avoids DANGEROUS_DOMAINS list (mailinator, etc.)
   * - Domain min length = 4 chars (a.co format)
   */
  const safeDomain = fc.string({ minLength: 1, maxLength: 30 })
    .filter((s) => /^[a-z][a-z0-9]{1,29}$/.test(s))
    .filter((s) => !['mailinator', 'spam', 'fake', 'test', 'localhost', 'invalid', 'nospam', 'nowhere', 'spam4', 'yopmail', 'maildrop'].includes(s))
    .filter((s) => !/^(temp|fake|test|spam|anonymous|noreply)/i.test(s));

  const safeTLD = fc.string({ minLength: 2, maxLength: 6 })
    .filter((s) => /^[a-z]{2,6}$/.test(s))
    .filter((s) => !['test', 'local', 'localhost'].includes(s));

  const safeLocalPart = fc.string({ minLength: 1, maxLength: 30 })
    .filter((s) => /^[a-z][a-z0-9._-]{0,29}$/.test(s))
    .filter((s) => !s.startsWith('.') && !s.endsWith('.') && !s.includes('..'));

  const safeEmail = fc.tuple(safeLocalPart, safeDomain, safeTLD)
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

  test('accepts well-formed safe email addresses', async () => {
    await fc.assert(
      fc.asyncProperty(safeEmail, async (email) => {
        const result = await parse(createAddressSchema, { ...validBase(), email });
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  test('accepts undefined email (email is optional)', async () => {
    const withoutEmail = { ...validBase() };
    delete withoutEmail.email;
    const result = await parse(createAddressSchema, withoutEmail);
    expect(result.success).toBe(true);
  });

  test('rejects strings with no @ symbol', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{1,50}$/).filter((s) => !s.includes('@')),
        async (email) => {
          const result = await parse(createAddressSchema, { ...validBase(), email });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects emails without a TLD (no dot after @)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).chain((local) =>
          fc.string({ minLength: 1, maxLength: 20 }).map((dom) => `${local}@${dom}`)
        ).filter((e) => {
          const domain = e.split('@')[1] || '';
          return !domain.includes('.');
        }),
        async (email) => {
          const result = await parse(createAddressSchema, { ...validBase(), email });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── String length constraints ─────────────────────────────────────────────────

describe('string length constraints — property-based', () => {
  test('name: accepts non-empty strings ≤100 chars after trim', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that have real content (not just whitespace)
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0 && s.trim().length <= 100),
        async (name) => {
          const result = await parse(createAddressSchema, { ...validBase(), name });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('name: rejects strings >100 non-whitespace chars (trim cannot reduce below limit)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // All-alphanumeric so trim cannot help — every char counts
        fc.stringMatching(/^[a-zA-Z0-9]{101,200}$/),
        async (name) => {
          const result = await parse(createAddressSchema, { ...validBase(), name });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  test('addressLine: accepts strings with real content ≤200 chars', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0 && s.trim().length <= 200),
        async (addressLine) => {
          const result = await parse(createAddressSchema, { ...validBase(), addressLine });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('addressLine: rejects strings >200 non-whitespace chars', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{201,300}$/),
        async (addressLine) => {
          const result = await parse(createAddressSchema, { ...validBase(), addressLine });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  test('city: rejects strings >50 non-whitespace chars (trim cannot reduce)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{51,100}$/),
        async (city) => {
          const result = await parse(createAddressSchema, { ...validBase(), city });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  test('state: rejects strings >50 non-whitespace chars (trim cannot reduce)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pure alphanumeric: trim() is a no-op, maxlength check fires correctly
        fc.stringMatching(/^[a-zA-Z0-9]{51,100}$/),
        async (state) => {
          const result = await parse(createAddressSchema, { ...validBase(), state });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  test('state: accepts strings ≤50 non-whitespace chars', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{1,50}$/),
        async (state) => {
          const result = await parse(createAddressSchema, { ...validBase(), state });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Label enum ────────────────────────────────────────────────────────────────

describe('label enum — property-based', () => {
  const validLabels = ['Home', 'Office', 'Store', 'Warehouse', 'Customer', 'Other'];

  test('accepts all valid label enum values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validLabels),
        async (label) => {
          const result = await parse(createAddressSchema, { ...validBase(), label });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: validLabels.length * 10 },
    );
  });

  test('rejects arbitrary non-enum strings as label', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{1,30}$/)
          .filter((s) => !validLabels.includes(s) && s.trim().length > 0),
        async (label) => {
          const result = await parse(createAddressSchema, { ...validBase(), label });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── updateAddressSchema is a strict partial ───────────────────────────────────

describe('updateAddressSchema — property-based', () => {
  test('accepts empty object (all fields optional in update)', async () => {
    const result = await parse(updateAddressSchema, {});
    expect(result.success).toBe(true);
  });

  test('rejects invalid phone (starting 0–5) even in partial update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }).chain((first) =>
          fc.stringMatching(/^\d{9}$/).map((rest) => `${first}${rest}`)
        ),
        async (phone) => {
          const result = await parse(updateAddressSchema, { phone });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects pincode starting with 0 even in partial update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^0\d{5}$/),
        async (pincode) => {
          const result = await parse(updateAddressSchema, { pincode });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('rejects pincodes longer than 6 digits even in partial update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 7, max: 12 }).chain((len) =>
          fc.stringMatching(new RegExp(`^[1-9]\\d{${len - 1}}$`))
        ),
        async (pincode) => {
          const result = await parse(updateAddressSchema, { pincode });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── listAddressQuerySchema ────────────────────────────────────────────────────

describe('listAddressQuerySchema — property-based', () => {
  test('accepts any positive integer page (1–1000) and pageSize (1–100) as string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        async (page, pageSize) => {
          const result = await parse(listAddressQuerySchema, {
            page: String(page),
            pageSize: String(pageSize),
          });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
