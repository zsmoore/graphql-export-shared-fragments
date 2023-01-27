import reWriteWithExports from './lib/export';

const args = process.argv.slice(2);
const path = args[0];
reWriteWithExports(path);

export default reWriteWithExports;
