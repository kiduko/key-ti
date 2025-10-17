try {
  const electron = require('electron');
  console.log('electron module:', electron);
  console.log('keys:', Object.keys(electron || {}));
} catch (e) {
  console.error('Error requiring electron:', e);
}
