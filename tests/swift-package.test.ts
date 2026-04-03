import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
    detectSwiftPackage,
    SwiftPackageState,
} from '../src/utils/swift-package';

const TEST_DIR = resolve(__dirname, 'temp-swift-package-test');

describe('detectSwiftPackage', () => {
    beforeEach(async () => {
        await mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    it('should return None if Package.swift does not exist', async () => {
        const info = await detectSwiftPackage(TEST_DIR);
        expect(info.state).toBe(SwiftPackageState.None);
    });

    it('should extract package name and default localization', async () => {
        const content = `
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MyProject",
    defaultLocalization: "en",
    targets: []
)
`;
        await writeFile(join(TEST_DIR, 'Package.swift'), content);
        const info = await detectSwiftPackage(TEST_DIR);

        expect(info.packageName).toBe('MyProject');
        expect(info.defaultLocalization).toBe('en');
        expect(info.state).toBe(SwiftPackageState.UnknownStructure);
    });

    it('should identify structure when Sources directory and target directory exist', async () => {
        const content = 'let package = Package(name: "MyPackage")';
        await writeFile(join(TEST_DIR, 'Package.swift'), content);

        const targetDir = join(TEST_DIR, 'Sources/MyPackage');
        await mkdir(targetDir, { recursive: true });

        const info = await detectSwiftPackage(TEST_DIR);

        expect(info.state).toBe(SwiftPackageState.IdentifiedStructure);
        expect(info.suggestedXCStringsPaths).toContain(
            'Sources/MyPackage/Resources/Localizable.xcstrings',
        );
        expect(info.suggestedXCStringsPaths).toContain(
            'Sources/MyPackage/Localizable.xcstrings',
        );
    });

    it('should identify structure if there is only one directory in Sources', async () => {
        await writeFile(
            join(TEST_DIR, 'Package.swift'),
            'let package = Package(name: "Whatever")',
        );

        const targetDir = join(TEST_DIR, 'Sources/SingleTarget');
        await mkdir(targetDir, { recursive: true });

        const info = await detectSwiftPackage(TEST_DIR);

        expect(info.state).toBe(SwiftPackageState.IdentifiedStructure);
        expect(info.suggestedXCStringsPaths).toContain(
            'Sources/SingleTarget/Resources/Localizable.xcstrings',
        );
        expect(info.suggestedXCStringsPaths).toContain(
            'Sources/SingleTarget/Localizable.xcstrings',
        );
    });

    it('should return UnknownStructure if multiple targets exist and none match package name', async () => {
        await writeFile(
            join(TEST_DIR, 'Package.swift'),
            'let package = Package(name: "MyPackage")',
        );

        await mkdir(join(TEST_DIR, 'Sources/TargetA'), { recursive: true });
        await mkdir(join(TEST_DIR, 'Sources/TargetB'), { recursive: true });

        const info = await detectSwiftPackage(TEST_DIR);

        expect(info.state).toBe(SwiftPackageState.UnknownStructure);
        expect(info.suggestedXCStringsPaths).toHaveLength(0);
    });
});
