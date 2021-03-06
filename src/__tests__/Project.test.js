// @flow
import path from 'path';
import Project from '../Project';
import Package from '../Package';
import * as logger from '../utils/logger';
import fixtures from 'fixturez';

const f = fixtures(__dirname);

jest.mock('../utils/logger');

function assertDependencies(graph, pkg, dependencies) {
  let val = graph.get(pkg);
  expect(val && val.dependencies).toEqual(dependencies);
}

function assertDependents(graph, pkg, dependents) {
  let val = graph.get(pkg);
  expect(val && val.dependents).toEqual(dependents);
}

// Asserts that a set of workspaces contains all (and only) the expected ones
function assertPackages(packages, expected) {
  expect(packages.map(pkg => pkg.getName())).toEqual(expected);
}

describe('Project', () => {
  let project;

  test('init()', async () => {
    let project = await Project.init(f.find('simple-project'));
    expect(project).toBeInstanceOf(Project);
    expect(project.pkg).toBeInstanceOf(Package);
  });

  test('getPackages() with simple project', async () => {
    let project = await Project.init(f.find('simple-project'));
    let packages = await project.getPackages();
    expect(packages.length).toEqual(2);
    expect(packages[0]).toBeInstanceOf(Package);
  });

  test('getPackages() with nested workspaces', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    expect(packages.length).toEqual(3);
    expect(packages[0]).toBeInstanceOf(Package);
  });

  test('getPackages() with nested workspaces and transitive dependents', async () => {
    let project = await Project.init(
      f.find('nested-workspaces-transitive-dependents')
    );
    let packages = await project.getPackages();
    expect(packages.length).toEqual(4);
    expect(packages[0]).toBeInstanceOf(Package);
  });

  test('getDependencyGraph() with nested workspaces', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let { valid, graph } = await project.getDependencyGraph(packages);
    let expectedDependencies = {
      'fixture-project-nested-workspaces': [],
      foo: ['bar'],
      bar: [],
      baz: ['bar']
    };

    expect(valid).toEqual(true);
    expect(graph).toBeInstanceOf(Map);
    expect(graph.size).toBe(4);

    Object.entries(expectedDependencies).forEach(([pkg, dependencies]) => {
      assertDependencies(graph, pkg, dependencies);
    });
  });

  test('getDependencyGraph() with nested workspaced and transitive dependents', async () => {
    let project = await Project.init(
      f.find('nested-workspaces-transitive-dependents')
    );
    let packages = await project.getPackages();
    let { valid, graph } = await project.getDependencyGraph(packages);
    let expectedDependencies = {
      'nested-workspaces-transitive-dependents': [],
      'pkg-a': [],
      'workspace-a': ['pkg-a'],
      'pkg-b': ['pkg-a'],
      'pkg-c': ['pkg-b']
    };

    expect(valid).toEqual(true);
    expect(graph).toBeInstanceOf(Map);
    expect(graph.size).toBe(Object.keys(expectedDependencies).length);

    let assertDependencies = (pkg, deps) => {
      let val = graph.get(pkg);
      expect(val && val.dependencies).toEqual(deps);
    };

    Object.entries(expectedDependencies).forEach(([pkg, dependencies]) => {
      assertDependencies(pkg, dependencies);
    });
  });

  test('getDependentsGraph() with nested workspaces', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let { valid, graph } = await project.getDependentsGraph(packages);
    let expectedDependents = {
      bar: ['foo', 'baz'],
      foo: [],
      baz: []
    };

    expect(valid).toEqual(true);
    expect(graph).toBeInstanceOf(Map);
    expect(graph.size).toBe(Object.keys(expectedDependents).length);

    Object.entries(expectedDependents).forEach(([pkg, dependents]) => {
      assertDependents(graph, pkg, dependents);
    });
  });

  test('getDependentsGraph() with nested workspaces and transitive dependents', async () => {
    let project = await Project.init(
      f.find('nested-workspaces-transitive-dependents')
    );
    let packages = await project.getPackages();
    let { valid, graph } = await project.getDependentsGraph(packages);
    let expectedDependents = {
      'pkg-a': ['workspace-a', 'pkg-b'],
      'workspace-a': [],
      'pkg-b': ['pkg-c'],
      'pkg-c': []
    };

    expect(valid).toEqual(true);
    expect(graph).toBeInstanceOf(Map);
    expect(graph.size).toBe(Object.keys(expectedDependents).length);

    Object.entries(expectedDependents).forEach(([pkg, dependents]) => {
      assertDependents(graph, pkg, dependents);
    });
  });

  test('filterPackages() with no flags', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {});
    assertPackages(filtered, ['bar', 'foo', 'baz']);
  });

  test('filterPackages() with only flag', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      only: 'foo'
    });
    assertPackages(filtered, ['foo']);
  });

  test('filterPackages() with only flag as glob', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      only: 'ba*'
    });
    assertPackages(filtered, ['bar', 'baz']);
  });

  test('filterPackages() with ignore flag', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      ignore: 'bar'
    });
    assertPackages(filtered, ['foo', 'baz']);
  });

  test('filterPackages() with only and ignore flags', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      only: 'ba*',
      ignore: 'bar'
    });
    assertPackages(filtered, ['baz']);
  });

  test('filterPackages() with onlyFs flag', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      onlyFs: 'packages/foo'
    });
    assertPackages(filtered, ['foo']);
  });

  test('filterPackages() with ignoreFs flag', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      ignoreFs: 'packages/foo'
    });
    assertPackages(filtered, ['bar', 'baz']);
  });

  test('filterPackages() with onlyFs and ignoreFs flags', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      onlyFs: '**/packages/ba*',
      ignoreFs: '**/bar'
    });
    assertPackages(filtered, ['baz']);
  });

  test('filterPackages() with only and ignoreFs flags', async () => {
    let project = await Project.init(f.find('nested-workspaces'));
    let packages = await project.getPackages();
    let filtered = await project.filterPackages(packages, {
      only: 'ba*',
      ignoreFs: '**/bar'
    });
    assertPackages(filtered, ['baz']);
  });

  test('filterPackages() with scoped workspaces', async () => {
    let project = await Project.init(
      f.find('nested-workspaces-with-scoped-package-names')
    );
    let packages = await project.getPackages();

    assertPackages(
      await project.filterPackages(packages, {
        only: '**/foo'
      }),
      ['@scope/foo']
    );

    assertPackages(
      await project.filterPackages(packages, {
        ignore: '**/foo'
      }),
      ['@scope/bar', '@scope/baz']
    );

    assertPackages(
      await project.filterPackages(packages, {
        onlyFs: '**/packages/ba*',
        ignore: '@scope/baz'
      }),
      ['@scope/bar']
    );
  });

  test('runPackageTasks() with simple project', async () => {
    let project = await Project.init(f.find('simple-project'));
    let packages = await project.getPackages();
    let spy = jest.fn(() => Promise.resolve());
    await project.runPackageTasks(packages, {}, spy);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Package);
  });

  test('runPackageTasks()', async () => {
    let project = await Project.init(f.find('simple-project'));
    let packages = await project.getPackages();
    let spy = jest.fn(() => Promise.resolve());
    await project.runPackageTasks(packages, {}, spy);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Package);
  });

  test('runPackageTasks() with independent workspaces', async () => {
    let cwd = f.find('independent-workspaces');
    let project = await Project.init(cwd);
    let packages = await project.getPackages();
    let ops = [];

    await project.runPackageTasks(packages, {}, async pkg => {
      ops.push('start:' + pkg.config.getName());
      // wait until next tick
      await Promise.resolve();
      ops.push('end:' + pkg.config.getName());
    });

    expect(ops).toEqual(['start:bar', 'start:foo', 'end:bar', 'end:foo']);
  });

  test('runPackageTasks() with dependent workspaces', async () => {
    let cwd = f.find('dependent-workspaces');
    let project = await Project.init(cwd);
    let packages = await project.getPackages();
    let ops = [];

    await project.runPackageTasks(packages, {}, async pkg => {
      ops.push('start:' + pkg.getName());
      // wait until next tick
      await Promise.resolve();
      ops.push('end:' + pkg.getName());
    });

    expect(ops).toEqual(['start:bar', 'end:bar', 'start:foo', 'end:foo']);
  });

  test('runPackageTasks() with dependent workspaces with cycle', async () => {
    let cwd = f.find('dependent-workspaces-with-cycle');
    let project = await Project.init(cwd);
    let packages = await project.getPackages();
    let ops = [];

    await project.runPackageTasks(packages, {}, async pkg => {
      ops.push('start:' + pkg.getName());
      // wait until next tick
      await Promise.resolve();
      ops.push('end:' + pkg.getName());
    });

    expect(ops).toEqual(['start:bar', 'end:bar', 'start:foo', 'end:foo']);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('runPackageTasks() orderMode: parallel', async () => {
    let project = await Project.init(f.find('simple-project'));
    let packages = await project.getPackages();
    let ops = [];

    await project.runPackageTasks(
      packages,
      { orderMode: 'parallel' },
      async pkg => {
        ops.push('start:' + pkg.getName());
        await Promise.resolve();
        ops.push('end:' + pkg.getName());
      }
    );

    expect(ops).toEqual(['start:bar', 'start:foo', 'end:bar', 'end:foo']);
  });

  test('runPackageTasks() orderMode: serial', async () => {
    let project = await Project.init(f.find('independent-workspaces'));
    let packages = await project.getPackages();
    let ops = [];

    await project.runPackageTasks(
      packages,
      { orderMode: 'serial' },
      async pkg => {
        ops.push('start:' + pkg.getName());
        await Promise.resolve();
        ops.push('end:' + pkg.getName());
      }
    );

    expect(ops).toEqual(['start:bar', 'end:bar', 'start:foo', 'end:foo']);
  });
});
