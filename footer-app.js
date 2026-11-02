/* DOKU: Baut den globalen Footer aus window.FOOTER_CONFIG auf und beobachtet data-quiz-active. Die in älteren Hinweisen genannten Rechtsseiten und footer-readme.md sind in dieser ZIP nicht enthalten. */
/**
 * footer-app.js — Logik des globalen Footers
 * -----------------------------------------------------------
 * Zugehörige Dateien (alle mit Präfix "footer-" erkennbar):
 *   footer-config.js       -> Daten (Links, Seitenname) — MUSS VOR dieser Datei geladen werden
 *   footer-style.css       -> Styling
 *   footer-impressum.html  -> verlinkte Rechtsseite
 *   footer-agb.html        -> verlinkte Rechtsseite
 *   footer-datenschutz.html-> verlinkte Rechtsseite
 *   footer-readme.md       -> Einbindungsanleitung
 *
 * Einbindung auf JEDER Seite (Reihenfolge wichtig):
 *   <link rel="stylesheet" href="/footer-style.css">
 *   ...
 *   <script src="/footer-config.js"></script>
 *   <script src="/footer-app.js" defer></script>
 *
 * Sicherheit: Footer wird ausschließlich per createElement/textContent
 * gebaut; Textinhalte werden dadurch nicht als HTML interpretiert.
 * Die href-Werte benötigen bei nicht vertrauenswürdigen Quellen eigene Prüfungen.
 *
 * Verhalten: Wird NICHT angezeigt, wenn <body data-quiz-active="true">.
 * Quiz-Seiten setzen dieses Attribut beim Start und entfernen es beim
 * Beenden/Auswertung (siehe footer-readme.md).
 */
(function () {
    'use strict';

    var FOOTER_ID = 'globaler-footer';

    // Fallback, falls footer-config.js aus Versehen nicht geladen wurde —
    // Footer bricht dann nicht komplett weg, sondern zeigt Minimal-Version.
    var config = window.FOOTER_CONFIG || {
        seitenname: 'FIAE Trainer',
        links: []
    };

/* DOKU: Prüft ausschließlich das body-Attribut, nicht den Firebase- oder Quizstatus selbst. */
    function istQuizAktiv() {
        return document.body.getAttribute('data-quiz-active') === 'true';
    }

/* DOKU: Verwendet textContent für den Linktext. href wird aus der Konfiguration übernommen; bei fremden Konfigurationsdaten wäre zusätzlich die URL zu prüfen. */
    function erzeugeLink(text, href) {
        var a = document.createElement('a');
        a.textContent = String(text);
        a.setAttribute('href', href);
        a.setAttribute('rel', 'noopener noreferrer');
        return a;
    }

/* DOKU: Erstellt DOM-Elemente für Jahreszahl, Seitenname und konfigurierte Links und gibt das noch nicht eingefügte footer-Element zurück. */
    function erzeugeFooter() {
        var footer = document.createElement('footer');
        footer.id = FOOTER_ID;
        footer.setAttribute('role', 'contentinfo');

        var innerWrapper = document.createElement('div');
        innerWrapper.className = 'footer-inner';

        var copyright = document.createElement('span');
        copyright.className = 'footer-copyright';
        copyright.textContent = '\u00A9 ' + new Date().getFullYear() + ' ' + config.seitenname;

        var nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Rechtliche Informationen');

        config.links.forEach(function (linkData, index) {
            nav.appendChild(erzeugeLink(linkData.text, linkData.href));
            if (index < config.links.length - 1) {
                var trenner = document.createElement('span');
                trenner.className = 'footer-trenner';
                trenner.textContent = '|';
                trenner.setAttribute('aria-hidden', 'true');
                nav.appendChild(trenner);
            }
        });

        innerWrapper.appendChild(copyright);
        innerWrapper.appendChild(nav);
        footer.appendChild(innerWrapper);

        return footer;
    }

/* DOKU: Entfernt eine frühere Footerinstanz und baut sie bei inaktivem Quiz neu auf. Passt zugleich die body-Klasse für den unteren Seitenabstand an. */
    function initFooter() {
        var vorhandener = document.getElementById(FOOTER_ID);
        if (vorhandener) {
            vorhandener.remove();
        }

        if (istQuizAktiv()) {
            document.body.classList.remove('hat-globalen-footer');
            return;
        }

        document.body.appendChild(erzeugeFooter());
        document.body.classList.add('hat-globalen-footer');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooter);
    } else {
        initFooter();
    }

    // Reagiert auf Laufzeit-Änderungen von data-quiz-active, z. B. wenn ein
    // Quiz ohne Seiten-Neuladen zwischen Frage und Auswertung wechselt.
    var beobachter = new MutationObserver(function (mutations) {
        var relevant = mutations.some(function (m) {
            return m.attributeName === 'data-quiz-active';
        });
        if (relevant) {
            initFooter();
        }
    });
    beobachter.observe(document.body, { attributes: true, attributeFilter: ['data-quiz-active'] });
})();