// Authoritative server-side property config.
// create-checkout.js reads this to verify prices from the client
// and to calculate fees — never trust amounts sent from the browser.

const PROPERTIES = {
  // Harbour — Playa Gigante, Nicaragua
  'c14d1f89-cbac-499c-a4aa-f2b0e8f2278e': {
    name:         'Shankton Harbour',
    cleaningFee:  7500,   // cents
    petFee:       6000,
    taxRate:      15,     // percent — Nicaragua IVA
    taxLabel:     'Nicaragua IVA',
    // pricingPropertyId: same as propertyId (no separate pricing source)
  },

  // Tower — Playa Gigante, Nicaragua
  '9c4ac1ba-6bc9-40b6-9f8e-0d6d18ea39e5': {
    name:         'Shankton Tower',
    cleaningFee:  7500,
    petFee:       6000,
    taxRate:      15,
    taxLabel:     'Nicaragua IVA',
  },

  // Peninsula Unit A — Belmont Shore, Long Beach, CA
  'c4a7f5ea-4ad5-4051-91c0-e72573fc21ba': {
    name:            'Shankton Peninsula · Unit A',
    cleaningFee:     25000,
    petFee:          15000,
    taxRate:         13.02,  // Long Beach TOT
    taxLabel:        'Long Beach TOT',
    pricingPropertyId: 'd2840288-b09e-49e9-8f97-a69f6b34f6d4',
  },

  // Peninsula Unit B — Belmont Shore, Long Beach, CA
  'd2840288-b09e-49e9-8f97-a69f6b34f6d4': {
    name:         'Shankton Peninsula · Unit B',
    cleaningFee:  25000,
    petFee:       15000,
    taxRate:      13.02,
    taxLabel:     'Long Beach TOT',
  },
};

module.exports = { PROPERTIES };
