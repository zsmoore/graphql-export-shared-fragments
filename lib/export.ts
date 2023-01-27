import {
  readFileSync, readdirSync, writeFileSync, statSync,
} from 'fs';
import {
  DefinitionNode,
  DirectiveNode,
  DocumentNode, FragmentDefinitionNode, Kind, parse, print, visit,
} from 'graphql';
import { resolve } from 'path';

const EXPORT_NAME = 'export';

function getAllFragmentDefs(document: DocumentNode): Map<string, FragmentDefinitionNode> {
  const fragmentDefs: Map<string, FragmentDefinitionNode> = new Map();
  document.definitions.filter((ele) => ele.kind === Kind.FRAGMENT_DEFINITION)
    .map((ele) => ele as FragmentDefinitionNode)
    .forEach((fragmentDefinition) => fragmentDefs
      .set(fragmentDefinition.name.value, fragmentDefinition));
  return fragmentDefs;
}

function getExportedFragments(document: DocumentNode): FragmentDefinitionNode[] {
  return document.definitions.filter((ele) => ele.kind === Kind.FRAGMENT_DEFINITION)
    .map((ele) => ele as FragmentDefinitionNode)
    .filter((fragmentDefinition) => fragmentDefinition.directives
      ?.some((directive) => directive.name.value === EXPORT_NAME));
}

function findUnkownFragmentNames(document: DocumentNode): Set<string> {
  const fragmentDefinitionsInFile: Set<string> = new Set(document.definitions
    .filter((ele) => ele.kind === Kind.FRAGMENT_DEFINITION)
    .map((ele) => ele as FragmentDefinitionNode)
    .map((ele) => ele.name.value));

  const fragmentSpreadsInFile: Set<string> = new Set();
  visit(document, {
    FragmentSpread(node) {
      fragmentSpreadsInFile.add(node.name.value);
    },
  });

  fragmentDefinitionsInFile.forEach((fragmentName) => fragmentSpreadsInFile.delete(fragmentName));
  return fragmentSpreadsInFile;
}

interface FileWithExportedFragments {
    filepath: string,
    exportedFragments: Map<string, FragmentDefinitionNode>
    fragmentsToFind: Set<string>
    allFragmentDefinitions: Map<string, FragmentDefinitionNode>
    originalDocument: DocumentNode
}

function getAllFilesInDir(path: string): string[] {
  const files: string[] = [];
  readdirSync(path).forEach((file) => {
    const absPath = resolve(path, file);
    if (absPath.endsWith('.graphql')) {
      files.push(absPath);
    } else {
      const statFile = statSync(absPath);
      if (statFile && statFile.isDirectory()) {
        files.push(...getAllFilesInDir(absPath));
      }
    }
  });
  return files;
}

function parsePath(path: string): FileWithExportedFragments[] {
  return getAllFilesInDir(path)
    .map((absPath: string) => {
      if (!absPath.endsWith('.graphql')) {
        return null;
      }
      const fileContent = readFileSync(absPath).toString();
      const asDocument: DocumentNode = parse(fileContent);
      const exportedFragmentDefinitions = getExportedFragments(asDocument);
      const exportedFragments: Map<string, FragmentDefinitionNode> = new Map();
      exportedFragmentDefinitions.forEach((ele) => {
        exportedFragments.set(ele.name.value, ele);
      });
      const fragmentsToFind = findUnkownFragmentNames(asDocument);
      const allFragmentDefinitions = getAllFragmentDefs(asDocument);
      return {
        filepath: absPath,
        exportedFragments,
        fragmentsToFind,
        allFragmentDefinitions,
        originalDocument: asDocument,
      };
    }).filter((ele) => ele !== null) as FileWithExportedFragments[];
}

function produceFragmentsToMark(allFiles: FileWithExportedFragments[]): Set<string> {
  const fragmentsToMark: Set<string> = new Set();
  allFiles.forEach((file) => {
    file.fragmentsToFind.forEach((fragmentName) => fragmentsToMark.add(fragmentName));
  });

  allFiles.forEach((file) => {
    file.exportedFragments.forEach((node) => {
      fragmentsToMark.add(node.name.value);
    });
  });
  return fragmentsToMark;
}

function writeBackWithExports(
  files: FileWithExportedFragments[],
  fragmentsToMark: Set<string>,
): void {
  files.forEach((fileWithData) => {
    let shouldWrite = false;
    const newDefs: DefinitionNode[] = [];
    fileWithData.originalDocument.definitions.forEach((definition) => {
      if (definition.kind === Kind.FRAGMENT_DEFINITION
                 && fragmentsToMark.has((definition as FragmentDefinitionNode).name.value)
                 && !(definition as FragmentDefinitionNode)
                   .directives?.some((directive) => directive.name.value === EXPORT_NAME)) {
        const asFragmentDef = definition as FragmentDefinitionNode;
        const directiveList: DirectiveNode[] = [];
        asFragmentDef.directives?.forEach((directive) => {
          directiveList.push(directive);
        });

        directiveList.push({
          kind: Kind.DIRECTIVE,
          name: {
            kind: Kind.NAME,
            value: EXPORT_NAME,
          },
        });
        const newFragmentDef: FragmentDefinitionNode = {
          kind: Kind.FRAGMENT_DEFINITION,
          loc: asFragmentDef.loc,
          typeCondition: asFragmentDef.typeCondition,
          directives: directiveList,
          selectionSet: asFragmentDef.selectionSet,
          name: asFragmentDef.name,
        };
        newDefs.push(newFragmentDef);
        shouldWrite = true;
      } else {
        newDefs.push(definition);
      }
    });
    if (shouldWrite) {
      const newDoc: DocumentNode = {
        definitions: newDefs,
        kind: fileWithData.originalDocument.kind,
        loc: fileWithData.originalDocument.loc,
      };
      const newDocString = print(newDoc);
      writeFileSync(fileWithData.filepath, newDocString);
    }
  });
}

export default function reWriteWithExports(path: string): void {
  const mappedFiles = parsePath(path);
  const fragmentsToMark = produceFragmentsToMark(mappedFiles);
  writeBackWithExports(mappedFiles, fragmentsToMark);
}
