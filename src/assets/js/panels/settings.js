/**
 * @author Luuxis / Modified for per-instance Java config
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

import { changePanel, accountSelect, database, Slider, config, setStatus, popup, appdata, setBackground } from '../utils.js'
const { ipcRenderer } = require('electron');
const os = require('os');

class Settings {
    static id = "settings";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.currentInstanceId = null;
        this.instanceSlider = null;

        this.navBTN();
        this.accounts();
        this.ram();
        this.javaPath();
        this.resolution();
        this.launcher();
        this.instanceJavaPanel();
    }

    navBTN() {
        document.querySelector('.nav-box').addEventListener('click', e => {
            const btn = e.target.closest('.nav-settings-btn');
            if (!btn) return;
            let id = btn.id;

            let activeSettingsBTN = document.querySelector('.active-settings-BTN');
            let activeContainerSettings = document.querySelector('.active-container-settings');

            if (id == 'save') {
                if (activeSettingsBTN) activeSettingsBTN.classList.remove('active-settings-BTN');
                document.querySelector('#account').classList.add('active-settings-BTN');
                if (activeContainerSettings) activeContainerSettings.classList.remove('active-container-settings');
                document.querySelector(`#account-tab`).classList.add('active-container-settings');
                return changePanel('home');
            }

            if (activeSettingsBTN) activeSettingsBTN.classList.remove('active-settings-BTN');
            btn.classList.add('active-settings-BTN');

            if (activeContainerSettings) activeContainerSettings.classList.remove('active-container-settings');
            document.querySelector(`#${id}-tab`).classList.add('active-container-settings');
        });
    }

    accounts() {
        document.querySelector('.accounts-list').addEventListener('click', async e => {
            let popupAccount = new popup();
            try {
                let target = e.target.closest('.account') || e.target.closest('.delete-profile');
                if (!target) return;
                let id = target.id;

                if (e.target.closest('.account') && !e.target.closest('.delete-profile')) {
                    popupAccount.openPopup({ title: 'Connexion', content: 'Veuillez patienter...', color: 'var(--color)' });
                    if (id == 'add') {
                        document.querySelector('.cancel-home').style.display = 'inline';
                        return changePanel('login');
                    }
                    let account = await this.db.readData('accounts', id);
                    let configClient = await this.setInstance(account);
                    await accountSelect(account);
                    configClient.account_selected = account.ID;
                    return await this.db.updateData('configClient', configClient);
                }

                if (e.target.closest('.delete-profile')) {
                    popupAccount.openPopup({ title: 'Suppression', content: 'Veuillez patienter...', color: 'var(--color)' });
                    await this.db.deleteData('accounts', id);
                    let deleteProfile = document.getElementById(`${id}`);
                    let accountListElement = document.querySelector('.accounts-list');
                    accountListElement.removeChild(deleteProfile);
                    if (accountListElement.children.length == 1) return changePanel('login');
                    let configClient = await this.db.readData('configClient');
                    if (configClient.account_selected == id) {
                        let allAccounts = await this.db.readAllData('accounts');
                        configClient.account_selected = allAccounts[0].ID;
                        accountSelect(allAccounts[0]);
                        let newInstanceSelect = await this.setInstance(allAccounts[0]);
                        configClient.instance_selct = newInstanceSelect.instance_selct;
                        return await this.db.updateData('configClient', configClient);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                popupAccount.closePopup();
            }
        });
    }

    async setInstance(auth) {
        let configClient = await this.db.readData('configClient');
        let instanceSelect = configClient.instance_selct;
        let instancesList = await config.getInstanceList();
        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(w => w == auth.name);
                if (whitelist !== auth.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
                        configClient.instance_selct = newInstanceSelect.name;
                        await setStatus(newInstanceSelect.status);
                    }
                }
            }
        }
        return configClient;
    }

    async ram() {
        let cfg = await this.db.readData('configClient');
        let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
        let freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} Go`;
        document.getElementById("free-ram").textContent = `${freeMem} Go`;

        let sliderDiv = document.querySelector(".memory-slider");
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        let ram = cfg?.java_config?.java_memory
            ? { ramMin: cfg.java_config.java_memory.min, ramMax: cfg.java_config.java_memory.max }
            : { ramMin: "1", ramMax: "2" };

        if (totalMem < ram.ramMin) {
            cfg.java_config.java_memory = { min: 1, max: 2 };
            this.db.updateData('configClient', cfg);
            ram = { ramMin: "1", ramMax: "2" };
        }

        let slider = new Slider(".memory-slider", parseFloat(ram.ramMin), parseFloat(ram.ramMax));
        let minSpan = document.querySelector(".slider-touch-left span");
        let maxSpan = document.querySelector(".slider-touch-right span");
        minSpan.setAttribute("value", `${ram.ramMin} Go`);
        maxSpan.setAttribute("value", `${ram.ramMax} Go`);

        slider.on("change", async (min, max) => {
            let c = await this.db.readData('configClient');
            minSpan.setAttribute("value", `${min} Go`);
            maxSpan.setAttribute("value", `${max} Go`);
            c.java_config.java_memory = { min, max };
            this.db.updateData('configClient', c);
        });
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt");
        javaPathText.textContent = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;

        let configClient = await this.db.readData('configClient');
        let javaPath = configClient?.java_config?.java_path || 'Utiliser la version de java livrée avec le launcher';
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        javaPathInputTxt.value = javaPath;

        document.querySelector(".java-path-set").addEventListener("click", async () => {
            javaPathInputFile.value = '';
            javaPathInputFile.click();
            await new Promise(resolve => {
                let interval = setInterval(() => {
                    if (javaPathInputFile.value != '') resolve(clearInterval(interval));
                }, 100);
            });
            if (javaPathInputFile.value.replace(".exe", '').endsWith("java") || javaPathInputFile.value.replace(".exe", '').endsWith("javaw")) {
                let c = await this.db.readData('configClient');
                let file = javaPathInputFile.files[0].path;
                javaPathInputTxt.value = file;
                c.java_config.java_path = file;
                await this.db.updateData('configClient', c);
            } else alert("Le nom du fichier doit être java ou javaw");
        });

        document.querySelector(".java-path-reset").addEventListener("click", async () => {
            let c = await this.db.readData('configClient');
            javaPathInputTxt.value = 'Utiliser la version de java livrée avec le launcher';
            c.java_config.java_path = null;
            await this.db.updateData('configClient', c);
        });
    }

    async resolution() {
        let configClient = await this.db.readData('configClient');
        let resolution = configClient?.game_config?.screen_size || { width: 1920, height: 1080 };
        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");
        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let c = await this.db.readData('configClient');
            c.game_config.screen_size.width = width.value;
            await this.db.updateData('configClient', c);
        });
        height.addEventListener("change", async () => {
            let c = await this.db.readData('configClient');
            c.game_config.screen_size.height = height.value;
            await this.db.updateData('configClient', c);
        });
        resolutionReset.addEventListener("click", async () => {
            let c = await this.db.readData('configClient');
            c.game_config.screen_size = { width: '854', height: '480' };
            width.value = '854'; height.value = '480';
            await this.db.updateData('configClient', c);
        });
    }

    async launcher() {
        let configClient = await this.db.readData('configClient');
        let maxDownloadFiles = configClient?.launcher_config?.download_multi || 5;
        let maxDownloadFilesInput = document.querySelector(".max-files");
        let maxDownloadFilesReset = document.querySelector(".max-files-reset");
        maxDownloadFilesInput.value = maxDownloadFiles;

        maxDownloadFilesInput.addEventListener("change", async () => {
            let c = await this.db.readData('configClient');
            c.launcher_config.download_multi = maxDownloadFilesInput.value;
            await this.db.updateData('configClient', c);
        });
        maxDownloadFilesReset.addEventListener("click", async () => {
            let c = await this.db.readData('configClient');
            maxDownloadFilesInput.value = 5;
            c.launcher_config.download_multi = 5;
            await this.db.updateData('configClient', c);
        });

        let themeBox = document.querySelector(".theme-box");
        let theme = configClient?.launcher_config?.theme || "auto";
        if (theme == "auto") document.querySelector('.theme-btn-auto').classList.add('active-theme');
        else if (theme == "dark") document.querySelector('.theme-btn-sombre').classList.add('active-theme');
        else if (theme == "light") document.querySelector('.theme-btn-clair').classList.add('active-theme');

        themeBox.addEventListener("click", async e => {
            let btn = e.target.closest('.theme-btn');
            if (!btn || btn.classList.contains('active-theme')) return;
            document.querySelector('.active-theme')?.classList.remove('active-theme');
            if (btn.classList.contains('theme-btn-auto')) { setBackground(); theme = "auto"; }
            else if (btn.classList.contains('theme-btn-sombre')) { setBackground(true); theme = "dark"; }
            else if (btn.classList.contains('theme-btn-clair')) { setBackground(false); theme = "light"; }
            btn.classList.add('active-theme');
            let c = await this.db.readData('configClient');
            c.launcher_config.theme = theme;
            await this.db.updateData('configClient', c);
        });

        let closeBox = document.querySelector(".close-box");
        let closeLauncher = configClient?.launcher_config?.closeLauncher || "close-launcher";
        if (closeLauncher == "close-launcher") document.querySelector('.close-launcher').classList.add('active-close');
        else if (closeLauncher == "close-all") document.querySelector('.close-all').classList.add('active-close');
        else if (closeLauncher == "close-none") document.querySelector('.close-none').classList.add('active-close');

        closeBox.addEventListener("click", async e => {
            let btn = e.target.closest('.close-btn');
            if (!btn || btn.classList.contains('active-close')) return;
            document.querySelector('.active-close')?.classList.remove('active-close');
            btn.classList.add('active-close');
            let c = await this.db.readData('configClient');
            if (btn.classList.contains('close-launcher')) c.launcher_config.closeLauncher = "close-launcher";
            else if (btn.classList.contains('close-all')) c.launcher_config.closeLauncher = "close-all";
            else if (btn.classList.contains('close-none')) c.launcher_config.closeLauncher = "close-none";
            await this.db.updateData('configClient', c);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PAR INSTANCE
    // ─────────────────────────────────────────────────────────────────────────

    async instanceJavaPanel() {
        let instancesList;
        try {
            instancesList = await config.getInstanceList();
        } catch (e) {
            console.error('Impossible de charger les instances', e);
            return;
        }

        const selectorList = document.querySelector('.instance-selector-list');
        const configPanel  = document.querySelector('.instance-config-panel');
        const nameBadge    = document.querySelector('.instance-config-name-badge');

        // Build instance buttons
        selectorList.innerHTML = '';
        for (let inst of instancesList) {
            let btn = document.createElement('div');
            btn.classList.add('instance-selector-btn');
            btn.dataset.name = inst.name;
            btn.innerHTML = `<span class="inst-icon"></span>${inst.name}`;
            selectorList.appendChild(btn);
        }

        selectorList.addEventListener('click', e => {
            let btn = e.target.closest('.instance-selector-btn');
            if (!btn) return;
            document.querySelectorAll('.instance-selector-btn').forEach(b => b.classList.remove('active-instance-btn'));
            btn.classList.add('active-instance-btn');
            this.loadInstanceConfig(btn.dataset.name, nameBadge, configPanel);
        });
    }

    async loadInstanceConfig(instanceName, nameBadge, configPanel) {
        this.currentInstanceId = instanceName;
        nameBadge.textContent = `⚙️ ${instanceName}`;
        configPanel.style.display = 'block';

        let configClient = await this.db.readData('configClient');
        let instanceConfigs = configClient?.instance_java_config || {};
        let instanceCfg = instanceConfigs[instanceName] || {};

        // Java version mode
        let mode = instanceCfg.java_path ? 'custom' : 'auto';
        document.querySelectorAll('input[name="java-version-mode"]').forEach(r => {
            r.checked = (r.value === mode);
        });
        this.toggleCustomJavaPath(mode === 'custom');

        let pathText = document.querySelector('.instance-java-path-text');
        pathText.value = instanceCfg.java_path || '';

        // JVM args
        let jvmArgs = instanceCfg.jvm_args || [];
        this.renderJvmTags(jvmArgs);

        // RAM override
        let ramOverride = instanceCfg.ram_override || false;
        let ramToggle = document.querySelector('.instance-ram-override-toggle');
        let ramSliderArea = document.querySelector('.instance-ram-slider-area');
        ramToggle.checked = ramOverride;
        ramSliderArea.style.display = ramOverride ? 'block' : 'none';

        if (ramOverride) {
            let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
            let sliderDiv = document.querySelector('.instance-memory-slider');
            sliderDiv.setAttribute('max', Math.trunc((80 * totalMem) / 100));
            let ramMin = instanceCfg.java_memory?.min || 1;
            let ramMax = instanceCfg.java_memory?.max || 2;
            if (this.instanceSlider) {
                this.instanceSlider = null;
                // Re-init slider
            }
            this.instanceSlider = new Slider('.instance-memory-slider', parseFloat(ramMin), parseFloat(ramMax));
            let minSpan = sliderDiv.querySelector('.slider-touch-left span');
            let maxSpan = sliderDiv.querySelector('.slider-touch-right span');
            minSpan.setAttribute('value', `${ramMin} Go`);
            maxSpan.setAttribute('value', `${ramMax} Go`);
            this.instanceSlider.on('change', (min, max) => {
                minSpan.setAttribute('value', `${min} Go`);
                maxSpan.setAttribute('value', `${max} Go`);
            });
        }

        // Bind events (remove and re-add to avoid duplicates)
        this.bindInstanceEvents(instanceName);
    }

    toggleCustomJavaPath(show) {
        let customPathDiv = document.querySelector('.instance-java-custom-path');
        customPathDiv.style.display = show ? 'flex' : 'none';
    }

    renderJvmTags(args) {
        let container = document.querySelector('.jvm-tags-container');
        container.innerHTML = '';
        for (let arg of args) {
            let tag = document.createElement('span');
            tag.classList.add('jvm-tag');
            tag.innerHTML = `${arg} <span class="jvm-tag-remove" data-arg="${arg}">✕</span>`;
            container.appendChild(tag);
        }
    }

    bindInstanceEvents(instanceName) {
        // Remove old listeners by cloning elements
        const cloneAndReplace = (selector) => {
            let el = document.querySelector(selector);
            if (!el) return null;
            let clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
            return clone;
        };

        // Java version radios
        document.querySelectorAll('input[name="java-version-mode"]').forEach(r => {
            r.addEventListener('change', () => this.toggleCustomJavaPath(r.value === 'custom'));
        });

        // File picker for instance java
        let fileInput = cloneAndReplace('.instance-java-path-file');
        let setBtn = cloneAndReplace('.instance-java-path-set');
        let resetBtn = cloneAndReplace('.instance-java-path-reset');

        setBtn.addEventListener('click', async () => {
            fileInput.value = '';
            fileInput.click();
            await new Promise(resolve => {
                let interval = setInterval(() => {
                    if (fileInput.value != '') resolve(clearInterval(interval));
                }, 100);
            });
            let val = fileInput.value;
            if (val.replace('.exe', '').endsWith('java') || val.replace('.exe', '').endsWith('javaw')) {
                document.querySelector('.instance-java-path-text').value = fileInput.files[0].path;
            } else alert('Le fichier doit être java ou javaw');
        });

        resetBtn.addEventListener('click', () => {
            document.querySelector('.instance-java-path-text').value = '';
            document.querySelector('input[value="auto"]').checked = true;
            this.toggleCustomJavaPath(false);
        });

        // JVM tag remove
        document.querySelector('.jvm-tags-container').addEventListener('click', async e => {
            let removeBtn = e.target.closest('.jvm-tag-remove');
            if (!removeBtn) return;
            let arg = removeBtn.dataset.arg;
            let c = await this.db.readData('configClient');
            let args = c?.instance_java_config?.[instanceName]?.jvm_args || [];
            args = args.filter(a => a !== arg);
            if (!c.instance_java_config) c.instance_java_config = {};
            if (!c.instance_java_config[instanceName]) c.instance_java_config[instanceName] = {};
            c.instance_java_config[instanceName].jvm_args = args;
            await this.db.updateData('configClient', c);
            this.renderJvmTags(args);
        });

        // JVM add button
        let addBtn = cloneAndReplace('.instance-jvm-arg-add');
        addBtn.addEventListener('click', async () => {
            let input = document.querySelector('.instance-jvm-arg-input');
            let val = input.value.trim();
            if (!val) return;
            let c = await this.db.readData('configClient');
            if (!c.instance_java_config) c.instance_java_config = {};
            if (!c.instance_java_config[instanceName]) c.instance_java_config[instanceName] = {};
            let args = c.instance_java_config[instanceName].jvm_args || [];
            if (!args.includes(val)) { args.push(val); c.instance_java_config[instanceName].jvm_args = args; }
            await this.db.updateData('configClient', c);
            this.renderJvmTags(args);
            input.value = '';
        });

        // JVM input Enter key
        document.querySelector('.instance-jvm-arg-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') addBtn.click();
        });

        // JVM presets
        document.querySelectorAll('.jvm-preset-chip').forEach(chip => {
            chip.addEventListener('click', async () => {
                let arg = chip.dataset.arg;
                let input = document.querySelector('.instance-jvm-arg-input');
                input.value = arg;
                addBtn.click();
            });
        });

        // RAM toggle
        let ramToggle = cloneAndReplace('.instance-ram-override-toggle');
        ramToggle.addEventListener('change', async () => {
            let ramSliderArea = document.querySelector('.instance-ram-slider-area');
            let on = ramToggle.checked;
            ramSliderArea.style.display = on ? 'block' : 'none';
            if (on && !this.instanceSlider) {
                let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
                let sliderDiv = document.querySelector('.instance-memory-slider');
                sliderDiv.setAttribute('max', Math.trunc((80 * totalMem) / 100));
                this.instanceSlider = new Slider('.instance-memory-slider', 1, 2);
                let minSpan = sliderDiv.querySelector('.slider-touch-left span');
                let maxSpan = sliderDiv.querySelector('.slider-touch-right span');
                minSpan.setAttribute('value', '1 Go');
                maxSpan.setAttribute('value', '2 Go');
                this.instanceSlider.on('change', (min, max) => {
                    minSpan.setAttribute('value', `${min} Go`);
                    maxSpan.setAttribute('value', `${max} Go`);
                });
            }
        });

        // Save button
        let saveBtn = cloneAndReplace('.instance-config-save');
        saveBtn.addEventListener('click', async () => {
            await this.saveInstanceConfig(instanceName);
            saveBtn.textContent = '✅ Sauvegardé !';
            setTimeout(() => saveBtn.textContent = '💾 Sauvegarder cette instance', 2000);
        });

        // Reset button
        let resetInstBtn = cloneAndReplace('.instance-config-reset');
        resetInstBtn.addEventListener('click', async () => {
            if (!confirm(`Réinitialiser la configuration de l'instance "${instanceName}" ?`)) return;
            let c = await this.db.readData('configClient');
            if (c.instance_java_config?.[instanceName]) {
                delete c.instance_java_config[instanceName];
                await this.db.updateData('configClient', c);
            }
            let nameBadge = document.querySelector('.instance-config-name-badge');
            let configPanel = document.querySelector('.instance-config-panel');
            this.instanceSlider = null;
            this.loadInstanceConfig(instanceName, nameBadge, configPanel);
        });
    }

    async saveInstanceConfig(instanceName) {
        let c = await this.db.readData('configClient');
        if (!c.instance_java_config) c.instance_java_config = {};
        if (!c.instance_java_config[instanceName]) c.instance_java_config[instanceName] = {};

        // Java path / mode
        let mode = document.querySelector('input[name="java-version-mode"]:checked')?.value || 'auto';
        let javaPath = mode === 'custom' ? document.querySelector('.instance-java-path-text').value.trim() : null;
        c.instance_java_config[instanceName].java_path = javaPath || null;

        // JVM args (already saved incrementally, just sync)
        let existingArgs = c.instance_java_config[instanceName].jvm_args || [];
        c.instance_java_config[instanceName].jvm_args = existingArgs;

        // RAM override
        let ramToggle = document.querySelector('.instance-ram-override-toggle');
        c.instance_java_config[instanceName].ram_override = ramToggle.checked;
        if (ramToggle.checked && this.instanceSlider) {
            let sliderDiv = document.querySelector('.instance-memory-slider');
            let minSpan = sliderDiv.querySelector('.slider-touch-left span');
            let maxSpan = sliderDiv.querySelector('.slider-touch-right span');
            let min = parseFloat(minSpan.getAttribute('value'));
            let max = parseFloat(maxSpan.getAttribute('value'));
            c.instance_java_config[instanceName].java_memory = { min, max };
        } else {
            delete c.instance_java_config[instanceName].java_memory;
        }

        await this.db.updateData('configClient', c);
    }
}

export default Settings;
