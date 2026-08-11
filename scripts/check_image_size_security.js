const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const imageSizePackagePath = require.resolve('image-size/package.json');
const installedImageSizeRoot = path.dirname(imageSizePackagePath);
const vendoredImageSizeRoot = path.resolve(__dirname, '..', 'third_party', 'image-size');
const appPackage = require('../package.json');
const imageSizePackage = require(imageSizePackagePath);

assert.equal(
  appPackage.devDependencies['image-size'],
  'file:third_party/image-size',
  'the application must install the repo-local image-size package',
);
assert.equal(
  appPackage.pnpm.overrides['image-size'],
  '$image-size',
  'pnpm must override every transitive image-size request with the direct local package',
);

const lockfile = fs.readFileSync(path.resolve(__dirname, '..', 'pnpm-lock.yaml'), 'utf8');
const lockfileImageSizeResolutions = [
  ...lockfile.matchAll(/^  image-size@(.+):$/gm),
].map((match) => match[1]);
assert.ok(lockfileImageSizeResolutions.length > 0, 'the lockfile must contain image-size');
assert.deepEqual(
  [...new Set(lockfileImageSizeResolutions)],
  ['file:third_party/image-size'],
  'every lockfile image-size package must resolve to the repo-local build',
);

const dependencyTree = JSON.parse(
  execFileSync('pnpm', ['list', 'image-size', '--depth', 'Infinity', '--json'], {
    encoding: 'utf8',
  }),
);
const imageSizeInstallations = new Map();
const pendingDependencies = [...dependencyTree];
while (pendingDependencies.length > 0) {
  const dependency = pendingDependencies.pop();
  for (const groupName of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, child] of Object.entries(dependency[groupName] || {})) {
      if (name === 'image-size') {
        imageSizeInstallations.set(child.path, child);
      }
      pendingDependencies.push(child);
    }
  }
}
assert.ok(imageSizeInstallations.size > 0, 'the installed dependency tree must contain image-size');
for (const installation of imageSizeInstallations.values()) {
  assert.equal(
    installation.version,
    'file:third_party/image-size',
    'every installed image-size version must be the repo-local build',
  );
  assert.equal(
    fs.realpathSync(installation.path),
    fs.realpathSync(installedImageSizeRoot),
    'every installed image-size path must resolve to the audited package instance',
  );
}
assert.equal(
  imageSizePackage.version,
  '2.0.3-burnt.1',
  'the installed image-size package must be the patched Burnt build',
);
for (const relativePath of ['dist/index.js', 'dist/types/icns.js', 'dist/types/utils.js']) {
  assert.equal(
    fs.readFileSync(path.join(installedImageSizeRoot, relativePath), 'utf8'),
    fs.readFileSync(path.join(vendoredImageSizeRoot, relativePath), 'utf8'),
    `the installed image-size ${relativePath} must match the vendored patch`,
  );
}

const imageSize = require('image-size');
const { findBox } = require('image-size/dist/types/utils.js');

const malformedIcns = Uint8Array.from([
  0x69, 0x63, 0x6e, 0x73,
  0x00, 0x00, 0x00, 0x10,
  0x69, 0x63, 0x30, 0x37,
  0x00, 0x00, 0x00, 0x00,
]);

assert.throws(
  () => imageSize(malformedIcns),
  /invalid ICNS image entry length/,
  'ICNS zero-length entries must be rejected',
);

const zeroLengthBox = Uint8Array.from([
  0x00, 0x00, 0x00, 0x00,
  0x6a, 0x78, 0x6c, 0x70,
]);

assert.throws(
  () => findBox(zeroLengthBox, 'jxlp', 0),
  /invalid image box size/,
  'JXL and HEIF zero-length boxes must be rejected',
);

assert.equal(
  typeof imageSize,
  'function',
  'the Metro file-path API must remain available',
);

const extendedSizeBox = Buffer.alloc(20);
extendedSizeBox.writeUInt32BE(1, 0);
extendedSizeBox.write('jxlc', 4, 'ascii');
extendedSizeBox.writeUInt32BE(0, 8);
extendedSizeBox.writeUInt32BE(20, 12);
assert.deepEqual(
  findBox(extendedSizeBox, 'jxlc', 0),
  { name: 'jxlc', headerSize: 16, offset: 0, size: 20 },
  'ISO BMFF extended-size boxes must use their 64-bit length and 16-byte header',
);

const largeIcnsLength = 600 * 1024;
const largeIcns = Buffer.alloc(largeIcnsLength);
largeIcns.write('icns', 0, 'ascii');
largeIcns.writeUInt32BE(largeIcnsLength, 4);
largeIcns.write('ic10', 8, 'ascii');
largeIcns.writeUInt32BE(largeIcnsLength - 8, 12);

assert.throws(
  () => imageSize(largeIcns.subarray(0, 16)),
  /invalid ICNS file length/,
  'truncated in-memory ICNS buffers must remain invalid',
);

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'image-size-'));
const largeIcnsPath = path.join(tempDirectory, 'large.icns');
const cappedPrefixLength = 512 * 1024;
const splitHeaderIcns = Buffer.alloc(cappedPrefixLength + 12);
splitHeaderIcns.write('icns', 0, 'ascii');
splitHeaderIcns.writeUInt32BE(splitHeaderIcns.length, 4);
splitHeaderIcns.write('ic10', 8, 'ascii');
splitHeaderIcns.writeUInt32BE(cappedPrefixLength - 12, 12);
splitHeaderIcns.write('ic09', cappedPrefixLength - 4, 'ascii');
splitHeaderIcns.writeUInt32BE(16, cappedPrefixLength);
const splitHeaderIcnsPath = path.join(tempDirectory, 'split-header.icns');
try {
  fs.writeFileSync(largeIcnsPath, largeIcns);
  assert.deepEqual(
    imageSize(largeIcnsPath),
    { width: 1024, height: 1024, type: 'ic10' },
    'valid ICNS files larger than the read cap must be detected from their bounded prefix',
  );
  fs.writeFileSync(splitHeaderIcnsPath, splitHeaderIcns);
  assert.deepEqual(
    imageSize(splitHeaderIcnsPath),
    {
      width: 1024,
      height: 1024,
      images: [{ width: 1024, height: 1024, type: 'ic10' }],
      type: 'icns',
    },
    'ICNS entry headers split by the read cap must not invalidate the file-path API',
  );
} finally {
  fs.rmSync(tempDirectory, { recursive: true });
}

console.log('image-size denial-of-service regressions passed');
