const data = require('../logs/debug-ZOOPLA-2026-02-11T12-02-40.json');

for (const item of data) {
  const nd = item && item.data && item.data.__NEXT_DATA__;
  const pp = nd && nd.props && nd.props.pageProps;
  if (!pp) { console.log('No pageProps for', item.url); continue; }

  const listing =
    pp.listingDetails ||
    (pp.data && pp.data.listing) ||
    pp.listing ||
    pp.listingDetail ||
    (pp.data && pp.data.listingDetails) ||
    pp.propertyDetails;

  if (!listing) {
    console.log('No listing found. pageProps keys:', Object.keys(pp));
    continue;
  }

  console.log('\n===== URL:', item.url, '=====');
  console.log('address:', JSON.stringify(listing.address, null, 2));

  // adTargeting - filter to address-like fields
  const at = listing.adTargeting || {};
  const atAddr = {};
  Object.keys(at).forEach(function(k) {
    if (/post|outc|inc|code|addr|town|city|county/i.test(k)) atAddr[k] = at[k];
  });
  console.log('adTargeting (address fields):', JSON.stringify(atAddr, null, 2));

  // analyticsTaxonomy - filter to address-like fields
  const tax = listing.analyticsTaxonomy || {};
  const taxAddr = {};
  Object.keys(tax).forEach(function(k) {
    if (/post|outc|inc|code|addr|town|city|county/i.test(k)) taxAddr[k] = tax[k];
  });
  console.log('analyticsTaxonomy (address fields):', JSON.stringify(taxAddr, null, 2));

  // location
  console.log('location:', JSON.stringify(listing.location, null, 2));
}
