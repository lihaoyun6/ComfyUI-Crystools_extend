import { app } from "../../scripts/app.js";

function removeLabelSpaces(textEl) {
    if (textEl) {
        if (textEl.innerText.includes(' ')) {
            textEl.innerText = textEl.innerText.replace(/\s+/g, '');
        }
        textEl.innerText = textEl.innerText.replace('VRAM', 'VRM').replace('Temp', 'TMP');
    }
}

app.registerExtension({
    name: "Crystools_extend.VerticalMonitors",
    async setup() {
        const isCrystoolsInstalled = app.extensions && app.extensions.some(ext => 
            ext && 
            ext.name && 
            ext.name.toLowerCase().includes("crystools") && 
            !ext.name.toLowerCase().includes("extend")
        );
        
        if (!isCrystoolsInstalled) return;
        
        app.ui.settings.addSetting({
            id: "Crystools.HideValue",
            category: ['Crystools', '🪛 Extend', 'Hide Value'],
            name: "Hide Value",
            type: "boolean",
            defaultValue: false,
            tooltip: "Hide percentage and temperature value, only available in compact mode"
        });
        
        app.ui.settings.addSetting({
            id: "Crystools.CompactMode",
            category: ['Crystools', '🪛 Extend', 'Compact Mode'],
            name: "Compact Mode",
            type: "boolean",
            defaultValue: true,
            tooltip: "Refresh required"
        });
        
        const compactMode = app.ui.settings.getSettingValue("Crystools.CompactMode");
        if (!compactMode) return;
        
        const overrideCss = `
        #crystools-monitors-root {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-end !important;
            justify-content: center !important;
            gap: 3px !important;
            padding: 5px 0;
        }

        #crystools-monitors-root .crystools-monitor {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-end !important;
            background: transparent !important;
        }

        #crystools-monitors-root .crystools-monitor[style*="display: none"],
        #crystools-monitors-root .crystools-monitor[style*="display:none"] {
            display: none !important;
        }

        #crystools-monitors-root .crystools-text {
            position: static !important;
            display: block !important;
            writing-mode: vertical-rl !important;
            text-orientation: upright !important;
            font-size: 0.5rem !important;
            line-height: 0.85 !important;
            margin-right: 3px !important;
            margin-bottom: 0 !important;
            //margin-top: -1px !important;
            text-align: left !important;
            align-self: flex-start !important; 
            white-space: nowrap !important;
            font-weight: 300 !important;
            font-family: monospace;
        }

        #crystools-monitors-root .crystools-content {
            position: relative !important;
            display: block !important;
            overflow: hidden !important;
            border-radius: 2.5px !important; 
            background-color: var(--comfy-input-bg, rgba(32, 32, 32, 0.6)) !important;
            border: 0.8px solid var(--comfy-menu-border, rgba(255, 255, 255, 0.2)) !important;
            box-sizing: border-box !important;
        }

        #crystools-monitors-root .crystools-slider {
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important; 
            transition-property: height, background-color !important; 
        }

        #crystools-monitors-root .crystools-label {
            writing-mode: vertical-rl !important;
            text-orientation: upright !important;
            position: absolute !important;
            width: 0.85em !important;
            bottom: 2px !important;
            right: auto !important;
            top: auto !important;
            height: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 2 !important;
            font-size: 0.6rem !important;
            font-weight: 400 !important;
            font-family: monospace !important;
            letter-spacing: -1px !important;
            line-height: 0.85 !important;
            pointer-events: none !important;
            text-shadow: 0 0 2px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.8) !important;
        }
        
        @supports (-webkit-app-region: inherit) {
            #crystools-monitors-root .crystools-label {
                letter-spacing: -2px !important;
            }
            
            #crystools-monitors-root .crystools-text {
                letter-spacing: -1.5px !important;
                margin-top: -1px !important;
            }
        }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'crystools-vertical-override-css';
        styleEl.innerText = overrideCss;
        document.head.appendChild(styleEl);

        function syncVerticalSize() {
            const srcStyle = document.getElementById('crystools-monitors-size');
            if (srcStyle && srcStyle.innerText) {
                const h = 10;
                const w = 32;
                
                const overrideId = 'crystools-monitors-size-vertical';
                let overrideStyle = document.getElementById(overrideId);
                if (!overrideStyle) {
                    overrideStyle = document.createElement('style');
                    overrideStyle.id = overrideId;
                    document.head.appendChild(overrideStyle);
                }
                const newCss = `
                #crystools-monitors-root .crystools-monitor .crystools-content {
                    height: ${w}px !important;
                    width: ${h}px !important;
                }\n`;
                if (overrideStyle.innerText !== newCss) overrideStyle.innerText = newCss;
            }
        }

        function updateSliderFromLabel(labelEl) {
            if (labelEl.dataset.updatingLabel) return;

            const rawText = labelEl.innerText;
            const percentMatch = rawText.match(/(\d+)/);
            
            if (percentMatch) {
                const percent = percentMatch[1];
                const slider = labelEl.parentElement?.querySelector('.crystools-slider');
                if (slider) slider.style.height = `${percent}%`;

                if (rawText.includes('%')) {
                    labelEl.dataset.updatingLabel = "true";
                    labelEl.innerText = rawText.replace('%', '');
                    labelEl.dataset.updatingLabel = "";
                }
                if (rawText.includes('°')) {
                    labelEl.dataset.updatingLabel = "true";
                    labelEl.innerText = rawText.replace('°', '');
                    labelEl.dataset.updatingLabel = "";
                }
                
                const hideValue = app.ui.settings.getSettingValue("Crystools.HideValue");
                if (hideValue) {
                    labelEl.dataset.updatingLabel = "true";
                    labelEl.innerText = '';
                    labelEl.dataset.updatingLabel = "";
                }
            }
        }

        const observer = new MutationObserver((mutations) => {
            let sizeChanged = false;

            mutations.forEach((mutation) => {
                if (mutation.target.id === 'crystools-monitors-size') sizeChanged = true;
                
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList.contains('crystools-text')) {
                                removeLabelSpaces(node);
                            } else {
                                node.querySelectorAll('.crystools-text').forEach(removeLabelSpaces);
                            }
                        }
                    });
                }
                
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    let target = mutation.target;
                    if (target.nodeType === Node.TEXT_NODE) target = target.parentNode;
                    
                    if (target && target.classList && target.classList.contains('crystools-label')) {
                        updateSliderFromLabel(target);
                    }
                }
            });

            if (sizeChanged) syncVerticalSize();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['id']
        });

        syncVerticalSize();
        setTimeout(() => {
            document.querySelectorAll('.crystools-label').forEach(updateSliderFromLabel);
            document.querySelectorAll('.crystools-text').forEach(removeLabelSpaces);
        }, 1000);
    }
});