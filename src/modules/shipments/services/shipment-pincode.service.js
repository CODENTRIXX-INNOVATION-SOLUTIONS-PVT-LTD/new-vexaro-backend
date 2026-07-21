'use strict';

const axios = require('axios');

const PINCODE_API_BASE_URL = 'https://api.postalpincode.in/pincode';

const normalizeLocation = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const matchesAny = (selected, values) => {
  const normalizedSelected = normalizeLocation(selected);
  return values.some((value) => normalizeLocation(value) === normalizedSelected);
};

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const validatePincodeLocationService = async ({ pincode, state, city }) => {
  let response;

  try {
    response = await axios.get(`${PINCODE_API_BASE_URL}/${encodeURIComponent(pincode)}`, {
      timeout: 7000,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    throw Object.assign(new Error('Could not verify pincode right now. Please try again.'), {
      statusCode: 502,
      cause: err,
    });
  }

  const result = Array.isArray(response.data) ? response.data[0] : response.data;
  const postOffices = Array.isArray(result?.PostOffice) ? result.PostOffice : [];

  if (result?.Status !== 'Success' || !postOffices.length) {
    return {
      isValid: false,
      pincode,
      stateMatches: false,
      cityMatches: false,
      message: 'This pincode was not found in India Post records.',
      matchedLocation: null,
    };
  }

  const stateMatches = postOffices.some((office) => matchesAny(state, [office.State]));
  const cityMatches = postOffices.some((office) =>
    matchesAny(city, [office.District, office.Name, office.Block, office.Division]),
  );

  const districts = uniqueValues(postOffices.map((office) => office.District));
  const states = uniqueValues(postOffices.map((office) => office.State));
  const offices = uniqueValues(postOffices.map((office) => office.Name)).slice(0, 10);
  const isValid = stateMatches && cityMatches;

  return {
    isValid,
    pincode,
    stateMatches,
    cityMatches,
    message: isValid
      ? 'Pincode matches the selected state and city.'
      : `This pincode belongs to ${districts.join(', ') || 'another city'}, ${states.join(', ') || 'another state'}.`,
    matchedLocation: {
      states,
      districts,
      offices,
    },
  };
};

module.exports = {
  validatePincodeLocationService,
};
