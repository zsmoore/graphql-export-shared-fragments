import * as assert from 'assert';

describe('getAllFragmentDefs', () => {
  it('should return an empty map when the input has no fragment definitions', () => {
    const document = parse('{ field }');
    const fragmentDefs = getAllFragmentDefs(document);
    assert.deepStrictEqual(fragmentDefs, new Map());
  });

  it('should return a map with the correct fragment definitions', () => {
    const document = parse('fragment A on Type { field } fragment B on Type { otherField }');
    const fragmentDefs = getAllFragmentDefs(document);
    const expected = new Map([
      ['A', document.definitions[0] as FragmentDefinitionNode],
      ['B', document.definitions[1] as FragmentDefinitionNode],
    ]);
    assert.deepStrictEqual(fragmentDefs, expected);
  });
});

describe('getExportedFragments', () => {
  it('should return an empty array when the input has no exported fragment definitions', () => {
    const document = parse('fragment A on Type { field }');
    const exportedFragments = getExportedFragments(document);
    assert.deepStrictEqual(exportedFragments, []);
  });

  it('should return an array with the correct exported fragment definitions', () => {
    const document = parse('fragment A on Type { field } fragment B on Type @export { otherField }');
    const exportedFragments = getExportedFragments(document);
    const expected = [document.definitions[1] as FragmentDefinitionNode];
    assert.deepStrictEqual(exportedFragments, expected);
  });
});

describe('findUnkownFragmentNames', () => {
  it('should return an empty set when the input has no fragment spreads', () => {
    const document = parse('fragment A on Type { field }');
    const unknownFragmentNames = findUnkownFragmentNames(document);
    assert.deepStrictEqual(unknownFragmentNames, new Set());
  });

  it('should return a set with the correct unknown fragment names', () => {
    const document = parse('fragment A on Type { ...B } fragment C on Type { ...D }');
    const unknownFragmentNames = findUnkownFragmentNames(document);
    const expected = new Set(['B', 'D']);
    assert.deepStrictEqual(unknownFragmentNames, expected);
  });
});

describe('getAllFilesInDir', () => {
  it('should return an empty array when the input directory is empty', () => {
    const files = getAllFilesInDir('test/fixtures/empty-dir');
    assert.deepStrictEqual(files, []);
  });

  it('should return an array with the correct file paths', () => {
    const files = getAllFilesInDir('test/fixtures/multiple-files');
    const expected = [
      'test/fixtures/multiple-files/file1.graphql',
      'test/fixtures/multiple-files/file2.graphql',
      'test/fixtures/multiple-files/nested/file3.graphql',
    ];
    assert.deepStrictEqual(files, expected);
  });
});

describe('parsePath', () => {
  it('should return an empty array when the input directory has no graphql files', () => {
    const parsed = parsePath('test/fixtures/empty-dir');
    assert.deepStrictEqual(parsed, []);
  });

  it('should return an array with the correct parsed files', () => {
    const parsed = parsePath('test/fixtures/multiple-files');
    const expected = [
      {
        filepath: 'test/fixtures/multiple-files/file1.graphql',
        exportedFragments: new Map(),
        fragmentsToFind: new Set(['B', 'C']),
        allFragmentDefinitions: new Map([
          ['A', parsed[0].allFragmentDefinitions.get
