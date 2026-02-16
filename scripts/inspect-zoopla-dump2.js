const data = require('../logs/debug-ZOOPLA-2026-02-11T12-02-40.json');

for (const item of data) {
  console.log('\n===== URL:', item.url, '=====');

  const nd = item && item.data && item.data.__NEXT_DATA__;
  if (!nd) { console.log('  NO __NEXT_DATA__ at all'); continue; }

  console.log('  __NEXT_DATA__ top keys:', Object.keys(nd));

  const props = nd.props;
  if (!props) { console.log('  no nd.props'); continue; }
  console.log('  nd.props keys:', Object.keys(props));

  const pp = props.pageProps;
  if (!pp) { console.log('  no props.pageProps'); continue; }
  console.log('  pageProps keys:', Object.keys(pp));

  // Check all known listing paths
  const paths = ['listingDetails','listing','listingDetail','propertyDetails'];
  paths.forEach(function(p) {
    if (pp[p]) console.log('  pp.' + p + ' EXISTS, keys:', Object.keys(pp[p]).slice(0,20).join(', '));
  });
  if (pp.data) {
    console.log('  pp.data keys:', Object.keys(pp.data).slice(0,20).join(', '));
    const dpaths = ['listing','listingDetails','listingDetail','propertyDetails'];
    dpaths.forEach(function(p) {
      if (pp.data[p]) console.log('  pp.data.' + p + ' EXISTS, keys:', Object.keys(pp.data[p]).slice(0,20).join(', '));
    });
  }

  // Dump analyticsTaxonomy wherever it lives
  function findField(obj, fieldName, path, depth) {
    if (!obj || typeof obj !== 'object' || depth > 6) return;
    if (obj[fieldName] !== undefined) {
      console.log('  FOUND', fieldName, 'at', path + '.' + fieldName + ':', JSON.stringify(obj[fieldName]));
    }
    Object.keys(obj).forEach(function(k) {
      if (k !== '__NEXT_DATA__' && typeof obj[k] === 'object') {
        findField(obj[k], fieldName, path + '.' + k, depth + 1);
      }
    });
  }

  // Search for postcode/outcode/incode fields
  ['analyticsTaxonomy','adTargeting','postcode','outcode','incode'].forEach(function(f) {
    findField(pp, f, 'pageProps', 0);
  });
}
