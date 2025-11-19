import { Plugin, MarkdownPostProcessorContext, MarkdownView, Notice, PluginSettingTab, App, Setting, MarkdownRenderer } from 'obsidian';
import * as child_process from 'child_process';

interface ExecutePythonSettings {
    pythonPath: string;
    showCodeInPreview: boolean;
    showExitCode: boolean;
}

const DEFAULT_SETTINGS: ExecutePythonSettings = {
    pythonPath: 'python',
    showCodeInPreview: true,
    showExitCode: false
}

export default class ExecutePython extends Plugin {
    settings: ExecutePythonSettings;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new MyPluginSettingTab(this.app, this));

        this.registerMarkdownCodeBlockProcessor('python', this.processPythonCodeBlock.bind(this));
    }

    processPythonCodeBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        if (this.settings.showCodeInPreview) {
            const pre = el.createEl('pre');
            const code = pre.createEl('code', { cls: 'language-python' });
            
            // @ts-ignore
            if (window.Prism && window.Prism.languages.python) {
                // @ts-ignore
                code.innerHTML = window.Prism.highlight(source, window.Prism.languages.python, 'python');
                code.addClass('is-loaded');
            } else {
                code.textContent = source;
                // @ts-ignore
                if (window.Prism) {
                    // @ts-ignore
                    window.Prism.highlightElement(code);
                }
            }
        }

        // Run the Python code only if the source starts with "# run"
        if (source.trim().startsWith("# run")) {
            const outputArea = el.createEl('pre', { cls: 'python-output' });
            this.runPythonCode(source, outputArea);
        }
    }


    async runPythonCode(source: string, outputArea: HTMLElement) {
        outputArea.textContent = '';  // Clear the output area before each run

        let outputCode: HTMLElement | null = null;

        const pythonProcess = child_process.spawn(this.settings.pythonPath, ['-u', '-c', source]);

        const handleOutput = new Promise<void>((resolve, reject) => {
            pythonProcess.stdout.on('data', (data) => {
                if (!outputCode) {
                    outputCode = outputArea.createEl('code');
                }
                outputCode.append(data.toString());
            });

            pythonProcess.stderr.on('data', (data) => {
                if (!outputCode) {
                    outputCode = outputArea.createEl('span', { cls: 'python-error-output' });
                }
                outputCode.append(`Error: ${data}`);
            });

            pythonProcess.on('close', (code) => {
                if (this.settings.showExitCode) {
                    if (!outputCode) {
                        outputCode = outputArea.createEl('span');
                    }
                    outputCode.append(`\nPython exited with code: ${code}`);
                }
                resolve();
            });

            pythonProcess.on('error', (err) => {
                reject(err);
            });
        });

        try {
            await handleOutput;
        } catch (err) {
            if (!outputCode) {
                outputCode = outputArea.createEl('span', { cls: 'python-error-output' });
            }
            outputCode.append(`\nAn error occurred: ${err}`);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class MyPluginSettingTab extends PluginSettingTab {
    plugin: ExecutePython;

    constructor(app: App, plugin: ExecutePython) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();
        new Setting(containerEl)
            .setName('Python')
            .setDesc('The command used to invoke Python on your system. (ex. python or python3)')
            .addText(text => text
                .setValue(this.plugin.settings.pythonPath)
                .onChange(async (value) => {
                    this.plugin.settings.pythonPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Toggle code snippet')
            .setDesc('Always show or hide Python code in the markdown preview.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCodeInPreview)
                .onChange(async (value) => {
                    this.plugin.settings.showCodeInPreview = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show exit code')
            .setDesc('Toggle whether to show the exit code message after code execution.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showExitCode)
                .onChange(async (value) => {
                    this.plugin.settings.showExitCode = value;
                    await this.plugin.saveSettings();
                }));
    }
}

