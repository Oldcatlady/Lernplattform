/* DOKU: Mehrfachauswahl für Semester, Fach und Thema. Ersetzt ein vorhandenes select durch details/summary und native Checkboxen; quizBit.html arbeitet über die zurückgegebene Schnittstelle. */
// Native Checkboxen: Mehrfachauswahl funktioniert auch ohne Strg-Taste.
/* DOKU: Eingabe: select mit ID und zugehörigem label. Rückgabe: Werte, Sperrzustand, Ereigniszugriff und setOptions. values liefert alle gewählten Werte, value nur den ersten bzw. leeren Text. */
export function createMultiSelect(select) {
    const id = select.id;
    const title = document.querySelector(`label[for="${id}"]`).textContent.trim();
    const root = document.createElement('details');
    root.className = 'multi-select';
    const summary = document.createElement('summary');
    summary.id = id;
    summary.setAttribute('aria-label', title);
    const panel = document.createElement('div');
    panel.className = 'multi-panel';
    const actions = document.createElement('div');
    actions.className = 'multi-actions';
    const all = document.createElement('button');
    all.type = 'button'; all.textContent = 'Alle auswählen';
    const clear = document.createElement('button');
    clear.type = 'button'; clear.textContent = 'Auswahl löschen';
    actions.append(all, clear);
    const list = document.createElement('div');
    list.className = 'multi-options';
    panel.append(actions, list); root.append(summary, panel); select.replaceWith(root);
    let options = [], chosen = new Set(), disabled = true, emptyLabel = 'Zuerst vorherigen Filter wählen';
/* DOKU: Gleicht Zusammenfassung, Checkboxen und Sperrmarkierung mit dem internen Set chosen ab. */
    function update() {
        summary.textContent = disabled ? emptyLabel : chosen.size ? options.filter(o => chosen.has(o.value)).map(o => o.label).join(', ') : `${title} auswählen`;
        summary.setAttribute('aria-disabled', String(disabled));
        root.classList.toggle('is-disabled', disabled);
        if (disabled) root.open = false;
        list.querySelectorAll('input').forEach(input => { input.checked = chosen.has(input.value); });
    }
/* DOKU: Aktualisiert die Darstellung und benachrichtigt das Dashboard über ein change-Ereignis am Ersatzsteuerelement. */
    function change() { update(); root.dispatchEvent(new Event('change')); }
    all.addEventListener('click', () => { chosen = new Set(options.map(o => o.value)); change(); });
    clear.addEventListener('click', () => { chosen.clear(); change(); });
    summary.addEventListener('click', event => { if (disabled) event.preventDefault(); });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') { root.open = false; summary.focus(); } });
    document.addEventListener('click', event => { if (!root.contains(event.target)) root.open = false; });
    root.addEventListener('toggle', () => {
        if (root.open) document.querySelectorAll('.multi-select').forEach(other => { if (other !== root) other.open = false; });
    });
    update();
    return {
        get values() { return [...chosen]; },
        get value() { return [...chosen][0] || ''; },
        get disabled() { return disabled; },
        set disabled(value) { disabled = value; update(); },
        classList: root.classList,
        addEventListener: (...args) => root.addEventListener(...args),
/* DOKU: Übernimmt Texte oder Objekte mit value/label. Bereits gewählte, weiterhin vorhandene Werte bleiben erhalten; weggefallene Werte werden entfernt. */
        setOptions(items, message = 'Keine passenden Optionen vorhanden') {
            options = items.map(item => typeof item === 'object' ? {...item, value: String(item.value)} : {value: String(item), label: String(item)});
            chosen = new Set([...chosen].filter(value => options.some(o => o.value === value)));
            disabled = !options.length; emptyLabel = message;
            list.replaceChildren();
            for (const option of options) {
                const label = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'checkbox'; input.value = option.value;
                const text = document.createElement('span'); text.textContent = option.label;
                input.addEventListener('change', event => {
                    event.stopPropagation();
                    if (input.checked) chosen.add(input.value); else chosen.delete(input.value);
                    change();
                });
                label.append(input, text); list.append(label);
            }
            update();
        }
    };
}
