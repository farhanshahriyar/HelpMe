const { exec } = require('child_process');

console.log('Launching snipping tool...');
exec('snippingtool /clip', (err, stdout, stderr) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Snipping tool finished.');
  }
});
