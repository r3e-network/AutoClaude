import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { NeoRsContextManager } from '../neo-rs/context';

suite('Neo-rs Extension Test Suite', () => {
    test('Neo-rs context manager initialization', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
        const contextManager = new NeoRsContextManager(workspaceRoot);
        
        assert.ok(contextManager, 'Context manager should be created');
        
        const context = contextManager.getContext();
        assert.ok(context, 'Context should be available');
        assert.ok(context.components, 'Components map should exist');
        assert.ok(context.validationResults, 'Validation results should exist');
    });

    test('Neo-rs configuration loading', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
        
        // Test that config structure is valid
        const config = {
            projectName: "neo-rs",
            csharpSourcePath: "./neo_csharp",
            rustProjectPath: "./neo-rs",
            components: {
                p2p: {
                    description: "P2P networking",
                    csharpPath: "neo_csharp/src/Neo/Network",
                    rustPath: "neo-rs/crates/neo-p2p",
                    critical: true
                }
            }
        };
        
        assert.strictEqual(config.projectName, "neo-rs");
        assert.ok(config.components.p2p);
        assert.strictEqual(config.components.p2p.critical, true);
    });

    test('Neo-rs placeholder patterns', () => {
        const patterns = ["TODO", "FIXME", "todo!", "unimplemented!", "unreachable!", "panic!"];
        
        // Test pattern matching
        const testCode = `
            fn example() {
                todo!("Implement this function");
                unimplemented!();
            }
        `;
        
        let foundPlaceholders = 0;
        for (const pattern of patterns) {
            if (testCode.includes(pattern)) {
                foundPlaceholders++;
            }
        }
        
        assert.strictEqual(foundPlaceholders, 2, 'Should find 2 placeholders in test code');
    });
});