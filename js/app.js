// ============================================================================
// WORTH THE BAG - Application principale
// ============================================================================

// Global state
let players = [];
let selectedPlayer = null;
let radarChart = null;
let advancedChart = null;
let offDefChart = null;
const statFields = ['PTS_per_game', 'REB_per_game', 'AST_per_game', 'PER', 'BPM', 'DEF_impact'];

// Mapping des équipes vers leurs logos
const teamLogoMap = {
    'Golden State Warriors': 'asset/logo_equipe/warriors.png',
    'San Antonio Spurs': 'asset/logo_equipe/spurs.png',
    'Philadelphia 76er': 'asset/logo_equipe/76er.png',
    'Oklahoma City Thunder': 'asset/logo_equipe/okc.png',
    'Memphis Grizzlies': 'asset/logo_equipe/grizzlies.png',
    'Atlanta Hawks': 'asset/logo_equipe/hawks.png',
    'Sacramento Kings': 'asset/logo_equipe/kings.png',
    'Denver Nuggets': 'asset/logo_equipe/nuggets.png',
    'Los Angeles Clippers': 'asset/logo_equipe/clippers.png'
};

// ============================================================================
// UTILITIES - Parsing CSV et données
// ============================================================================

/**
 * Convertir un nombre français (virgule décimale) en nombre
 * Exemple: "6,8" -> 6.8
 */
function toNumberFR(value) {
    if (!value) return 0;
    const str = value.toString().trim();
    // Remplacer virgule par point pour parseFloat
    return parseFloat(str.replace(',', '.'));
}

/**
 * Extraire le pourcentage d'une chaîne
 * Exemple: "53 %" -> 53, "53%" -> 53
 */
function toPercent(value) {
    if (!value) return 0;
    const str = value.toString().trim();
    // Supprimer le symbole % et les espaces
    return parseFloat(str.replace(/[\s%]/g, ''));
}

/**
 * Parse CSV text into array of objects
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const obj = {};
        const values = parseCSVLine(lines[i]);
        
        headers.forEach((header, index) => {
            obj[header] = values[index] ? values[index].trim() : '';
        });
        
        data.push(obj);
    }
    
    return data;
}

/**
 * Parse une ligne CSV en respectant les guillemets
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/**
 * Normaliser les données d'un joueur
 */
function normalizePlayer(rawPlayer) {
    const player = { ...rawPlayer };
    
    // Convertir les nombres décimaux avec virgule en point
    const decimalFields = [
        'Age', 'Minutes_Played', 'PTS_per_game', 'AST_per_game', 'REB_per_game',
        'STL_per_game', 'BLK_per_game', 'TOV_per_game', 'FGA_per_game',
        'TwoPA_per_game', 'Tir_a_2_points_reussi', 'ThreePA_per_game', 'ThreeP_per_game',
        'FTA_per_game', 'FT_per_game', 'PER', 'TS_Pct', 'eFG_Pct', 'BPM', 'OBPM', 'DBPM', 'WS'
    ];
    
    decimalFields.forEach(field => {
        if (player[field]) {
            player[field] = toNumberFR(player[field]);
        }
    });
    
    // Convertir les pourcentages
    const percentFields = ['FG_Pct', 'TwoP_Pct', 'ThreeP_Pct', 'FT_Pct', 'TS_Pct', 'eFG_Pct'];
    percentFields.forEach(field => {
        if (player[field]) {
            player[field] = toPercent(player[field]);
        }
    });
    
    // Parser le salaire
    player.SalaryDisplay = player.Salary; // Garder version affichage
    player.SalaryNumeric = parseSalary(player.Salary);
    
    // Parser age
    if (player.Age) {
        player.Age = parseInt(player.Age.toString().replace(' ans', ''));
    }
    
    // Calculer l'impact défensif (STL + BLK combinés)
    const stl = player.STL_per_game || 0;
    const blk = player.BLK_per_game || 0;
    player.DEF_impact = stl + blk;
    
    return player;
}

/**
 * Extraire un nombre du salaire
 * CORRECTION: Salaire dans CSV est déjà en format corrected (ex: "55 761 216 millions")
 * On l'extrait directement sans diviser par 1M
 */
function parseSalary(salaryStr) {
    if (!salaryStr) return 0;
    
    const str = salaryStr.toString().toLowerCase().trim();
    
    // Extraire tous les chiffres et remplacer les espaces/virgules
    let number = parseFloat(str.replace(/\s/g, '').replace(',', '.'));
    
    // Le nombre brut du CSV est déjà en unités correctes
    // On ne divise pas par 1M
    
    return number;
}

/**
 * Formater un nombre pour l'affichage
 */
function formatNumber(num, decimals = 1) {
    if (typeof num !== 'number') return '-';
    return num.toFixed(decimals);
}

/**
 * Formater le salaire pour l'affichage
 */
function formatSalary(salary) {
    if (!salary) return '-';
    // Le salaire en entrée est maintenant en millions directement
    if (salary >= 1000000) {
        return '$' + (salary / 1_000_000).toFixed(2) + 'M';
    }
    return '$' + salary.toLocaleString();
}

/**
 * Parser le ratio AST/TOV
 * Format: "6,0 pour 2,9" -> retourne 6.0 / 2.9 = 2.07
 */
function parseAstTov(value) {
    if (!value) return 0;
    const str = value.toString().trim();
    
    // Vérifier si c'est le format "X pour Y"
    if (str.includes('pour')) {
        const parts = str.split('pour').map(p => toNumberFR(p.trim()));
        if (parts.length === 2 && parts[1] !== 0) {
            return parts[0] / parts[1];
        }
    }
    
    // Sinon essayer de parser comme nombre simple
    return toNumberFR(str);
}

/**
 * Normaliser une valeur sur une échelle 0-100 (clampée)
 * @param value - La valeur brute
 * @param min - Minimum de la plage
 * @param max - Maximum de la plage
 * @returns Valeur entre 0 et 100
 */
function normalizeToScale(value, min, max) {
    if (value === null || value === undefined) return 0;
    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, normalized));
}

/**
 * Retourner un label d'impact basé sur la valeur
 */
function getImpactLabel(metricName, value) {
    const labels = {
        'AST/TOV': [
            { threshold: 4, label: 'Excellent' },
            { threshold: 2.5, label: 'Très bon' },
            { threshold: 1.5, label: 'Bon' },
            { threshold: 0, label: 'À améliorer' }
        ],
        'PER': [
            { threshold: 25, label: 'MVP' },
            { threshold: 20, label: 'Excellent' },
            { threshold: 15, label: 'Très bon' },
            { threshold: 10, label: 'Bon' },
            { threshold: 0, label: 'Moyen' }
        ],
        'BPM': [
            { threshold: 8, label: 'Elite' },
            { threshold: 4, label: 'Excellent' },
            { threshold: 2, label: 'Très bon' },
            { threshold: -2, label: 'Neutre' },
            { threshold: -100, label: 'Négatif' }
        ],
        'OBPM': [
            { threshold: 5, label: 'Elite' },
            { threshold: 2, label: 'Excellent' },
            { threshold: 0, label: 'Bon' },
            { threshold: -2, label: 'Moyen' },
            { threshold: -100, label: 'Faible' }
        ],
        'DBPM': [
            { threshold: 5, label: 'Elite' },
            { threshold: 2, label: 'Excellent' },
            { threshold: 0, label: 'Bon' },
            { threshold: -2, label: 'Moyen' },
            { threshold: -100, label: 'Faible' }
        ],
        'WS': [
            { threshold: 10, label: 'Elite' },
            { threshold: 5, label: 'Excellent' },
            { threshold: 3, label: 'Très bon' },
            { threshold: 1, label: 'Bon' },
            { threshold: 0, label: 'Moyen' }
        ]
    };
    
    const thresholds = labels[metricName] || [];
    for (const t of thresholds) {
        if (value >= t.threshold) {
            return t.label;
        }
    }
    return '-';
}

// ============================================================================
// LOADING DATA
// ============================================================================

async function loadPlayers() {
    try {
        const response = await fetch('data/players.csv');
        const csvText = await response.text();
        
        const rawPlayers = parseCSV(csvText);
        players = rawPlayers.map(normalizePlayer);
        
        if (players.length > 0) {
            selectedPlayer = players[0];
            initializeUI();
            updateAllSections();
        }
    } catch (error) {
        console.error('Erreur chargement CSV:', error);
    }
}

// ============================================================================
// UI INITIALIZATION
// ============================================================================

function initializeUI() {
    initializeSidebar();
    initializePlayerModal();
    initializeCourtInteractivity();
}

function initializeSidebar() {
    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            updateSidebarActive(link);
            const section = link.getAttribute('data-section');
            scrollToSection(section);
        });
    });
}

function updateSidebarActive(link) {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
}

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        const link = document.querySelector(`[data-section="${sectionId}"]`);
        if (link) updateSidebarActive(link);
    }
}

function initializePlayerModal() {
    const modal = document.getElementById('playerModal');
    document.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePlayerModal();
        }
    });
    
    populatePlayerGrid();
}

function populatePlayerGrid() {
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = '';
    
    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-grid-item';
        item.onclick = () => selectPlayerFromModal(player);
        
        const img = document.createElement('img');
        img.src = getPlayerPhotoPath(player.Player);
        img.alt = player.Player;
        img.onerror = function() { this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="10" font-family="sans-serif"%3E?' + player.Player.substring(0,2) + '%3C/text%3E%3C/svg%3E'; };
        
        const name = document.createElement('p');
        name.textContent = player.Player;
        
        item.appendChild(img);
        item.appendChild(name);
        grid.appendChild(item);
    });
}

// ============================================================================
// PLAYER SELECTION
// ============================================================================

function openPlayerModal() {
    document.getElementById('playerModal').style.display = 'block';
}

function closePlayerModal() {
    document.getElementById('playerModal').style.display = 'none';
}

function selectPlayerFromModal(player) {
    selectedPlayer = player;
    closePlayerModal();
    updateAllSections();
}

function getPlayerPhotoPath(playerName) {
    const nameMap = {
        'Stephen Curry': 'stephen_curry.png',
        'Victor Wembanyama': 'victor_wembanyama.png',
        'Paul George': 'paul_george.png',
        'Alex Caruso': 'alex_caruso.png',
        'Desmond Bane': 'desmond_bane.png',
        'Zaccharie Risacher': 'zaccharie_risacher.png',
        'Zach LaVine': 'zach_lavine.png',
        'Michael Porter Jr': 'michael_porter_jr.png',
        'Nikola Jokic': 'nikola_jokic.png',
        'Russell Westbrook': 'russell_westbrook.png',
        'Kawhi Leonard': 'kawhi_leonard.png',
        'Joel EmbiId': 'joel_embiid.png'
    };
    
    const filename = nameMap[playerName] || '';
    return filename ? `photo_joueurs/${filename}` : '';
}

// ============================================================================
// UPDATE SECTIONS
// ============================================================================

function updateAllSections() {
    updateSection2();
    updateSection3();
    updateAdvancedSection();
    updateSection4();
}

// ==================== SECTION 2 ====================
function updateSection2() {
    if (!selectedPlayer) return;
    
    // Avatar
    const avatar = document.getElementById('selectedPlayerAvatar');
    avatar.src = getPlayerPhotoPath(selectedPlayer.Player);
    avatar.onerror = function() { this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3C/svg%3E'; };
    
    // Logo de l'équipe dans la card
    const teamLogoCard = document.getElementById('teamLogoCard');
    const logoPath = teamLogoMap[selectedPlayer.Team];
    if (logoPath) {
        teamLogoCard.innerHTML = `<img src="${logoPath}" alt="${selectedPlayer.Team}" class="team-logo-card">`;
        teamLogoCard.querySelector('img').onerror = function() { 
            teamLogoCard.innerHTML = `<img src="asset/icons/icone_matchs_joues.svg" alt="Équipe">`; 
        };
    } else {
        teamLogoCard.innerHTML = `<img src="asset/icons/icone_matchs_joues.svg" alt="Équipe">`;
    }
    
    // Context cards - afficher le nom de l'équipe en valeur
    document.getElementById('contextTeam').textContent = selectedPlayer.Team || '-';
    document.getElementById('contextGames').textContent = selectedPlayer.Games_Played || '-';
    document.getElementById('contextStarts').textContent = selectedPlayer.Games_Started || '-';
    document.getElementById('contextSalary').textContent = formatSalary(selectedPlayer.SalaryNumeric);
    
    // Radar chart
    updateRadarChart();
}

function updateRadarChart() {
    if (!selectedPlayer) return;
    
    // Définir les max réalistes pour chaque stat
    const maxValues = {
        'PTS_per_game': 35,
        'REB_per_game': 15,
        'AST_per_game': 12,
        'PER': 32,
        'BPM': 15,
        'DEF_impact': 3.5
    };
    
    // Récupérer les valeurs brutes du joueur
    const radarValues = statFields.map(field => parseFloat(selectedPlayer[field]) || 0);
    const radarLabels = statFields.map(field => formatRadarLabel(field));
    
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    if (radarChart) {
        radarChart.data.labels = radarLabels;
        radarChart.data.datasets[0].data = radarValues;
        radarChart.data.datasets[0].label = selectedPlayer.Player;
        radarChart.update();
    } else {
        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [{
                    label: selectedPlayer.Player,
                    data: radarValues,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.15)',
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    borderWidth: 2.5,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            font: { family: "'Inter Tight', sans-serif", size: 12 },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.r;
                                const label = context.label;
                                return label + ': ' + parseFloat(value).toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 35,
                        ticks: {
                            font: { family: "'Inter Tight', sans-serif", size: 10 }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: true
                        },
                        pointLabels: {
                            font: { family: "'Inter Tight', sans-serif", size: 11, weight: 600 }
                        }
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });
    }
}

function formatRadarLabel(field) {
    const labels = {
        'PTS_per_game': 'PTS',
        'REB_per_game': 'REB',
        'AST_per_game': 'AST',
        'PER': 'PER',
        'BPM': 'BPM',
        'DEF_impact': 'DEF'
    };
    return labels[field] || field;
}

// ==================== SECTION 3 ====================
function updateSection3() {
    if (!selectedPlayer) return;
    
    // Tir global
    const fg = selectedPlayer.FG_Pct || 0;
    updateStatBar('FG', fg);
    
    // 2 points
    const twoP = selectedPlayer.TwoP_Pct || 0;
    updateStatBar('2P', twoP);
    
    // 3 points
    const threeP = selectedPlayer.ThreeP_Pct || 0;
    updateStatBar('3P', threeP);
    
    // Lancers francs
    const ft = selectedPlayer.FT_Pct || 0;
    updateStatBar('FT', ft);
    
    // TS%
    const ts = selectedPlayer.TS_Pct || 0;
    updateStatBar('TS', ts);
    
    // eFG%
    const efg = selectedPlayer.eFG_Pct || 0;
    updateStatBar('EFG', efg);
    
    // Court info
    updateCourtInfo();
}

function updateStatBar(stat, value) {
    const percent = Math.min(value, 100);
    document.getElementById(`stat${stat}`).textContent = formatNumber(value);
    document.getElementById(`progress${stat}`).style.width = percent + '%';
}

function updateCourtInfo() {
    if (!selectedPlayer) return;
    
    // CORRECTION: zone2p et zone3p n'existent pas dans le HTML
    // L'interactivité du terrain est gérée via les SVG paths (zone2p-path et zone3p-path)
    // Pas besoin de mettre à jour des éléments qui n'existent pas
    
    // Les tooltips sont affichées en hover sur les zones SVG via initializeCourtInteractivity()
}

// ==================== SECTION 4 ====================
function updateSection4() {
    if (!selectedPlayer) return;
    
    // Photo
    const photo = document.getElementById('verdictPlayerPhoto');
    photo.src = getPlayerPhotoPath(selectedPlayer.Player);
    photo.onerror = function() { this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3C/svg%3E'; };
    
    // Nom
    document.getElementById('verdictPlayerName').textContent = selectedPlayer.Player;
    
    // Calcul verdict
    const verdict = calculateVerdict(selectedPlayer);
    
    // Pastille
    const pastilleFile = verdict.pastille;
    document.getElementById('verdictPastille').src = `asset/icons/${pastilleFile}`;
    
    // Texte
    document.getElementById('verdictText').textContent = verdict.text;
    
    // Index
    document.getElementById('verdictIndex').textContent = formatNumber(verdict.index, 2);
}

function calculateVerdict(player) {
    // Performance score
    const pts = player.PTS_per_game || 0;
    const reb = player.REB_per_game || 0;
    const ast = player.AST_per_game || 0;
    const bpm = player.BPM || 0;
    const ws = player.WS || 0;
    const per = player.PER || 0;
    
    const performanceScore = (pts * 2) + (reb * 1.2) + (ast * 1.5) + (bpm * 2) + (ws * 1.5) + (per * 1);
    
    // Salary en millions (BUT MMI2: SalaryNumeric is raw from CSV, divide by 1M)
    const salaryMillions = player.SalaryNumeric > 0 ? player.SalaryNumeric / 1_000_000 : 0;
    
    // Value index
    const valueIndex = salaryMillions > 0 ? performanceScore / salaryMillions : 0;
    
    // Classification
    let pastille = 'pastille_jaune.svg';
    let text = 'Bon rapport qualité/prix';
    
    if (valueIndex > 3.5) {
        pastille = 'pastille_verte.svg';
        text = `${player.Player} est largement sous-payé ! C'est une excellente affaire pour son équipe.`;
    } else if (valueIndex > 2.2) {
        pastille = 'pastille_verte.svg';
        text = `${player.Player} offre un excellent rapport qualité/prix. Une belle acquisition.`;
    } else if (valueIndex > 1.5) {
        pastille = 'pastille_jaune.svg';
        text = `${player.Player} a un rapport qualité/prix correct, avec une légère sur-évaluation salariale.`;
    } else if (valueIndex > 1.0) {
        pastille = 'pastille_jaune.svg';
        text = `${player.Player} est un peu surpayé relativement à ses performances.`;
    } else {
        pastille = 'pastille_rouge.svg';
        text = `${player.Player} est clairement surpayé pour ses performances actuelles.`;
    }
    
    return {
        pastille,
        text,
        index: valueIndex
    };
}

// ============================================================================
// SECTION 4: Advanced Stats (NEW)
// ============================================================================

/**
 * Mettre à jour la section Stats Avancées
 */
function updateAdvancedSection() {
    if (!selectedPlayer) return;
    
    // Parser les stats avancées
    const astTov = parseAstTov(selectedPlayer.AST_TOV_ratio);
    const per = selectedPlayer.PER || 0;
    const bpm = selectedPlayer.BPM || 0;
    const obpm = selectedPlayer.OBPM || 0;
    const dbpm = selectedPlayer.DBPM || 0;
    const ws = selectedPlayer.WS || 0;
    
    // Mettre à jour les KPI cards
    updateKpiCard('AstTov', astTov !== null ? astTov.toFixed(2) : '-', 'AST/TOV', getImpactLabel('AST/TOV', astTov || 0));
    updateKpiCard('Per', per > 0 ? per.toFixed(1) : '-', 'PER', getImpactLabel('PER', per));
    updateKpiCard('Bpm', bpm !== null ? bpm.toFixed(1) : '-', 'BPM', getImpactLabel('BPM', bpm || 0));
    updateKpiCard('Obpm', obpm !== null ? obpm.toFixed(1) : '-', 'OBPM', getImpactLabel('OBPM', obpm || 0));
    updateKpiCard('Dbpm', dbpm !== null ? dbpm.toFixed(1) : '-', 'DBPM', getImpactLabel('DBPM', dbpm || 0));
    updateKpiCard('Ws', ws > 0 ? ws.toFixed(1) : '-', 'WS', getImpactLabel('WS', ws));
    
    // Mettre à jour le chart
    updateAdvancedChart(astTov, per, bpm, obpm, dbpm, ws);
    
    // Mettre à jour le chart offensif/défensif
    updateOffDefChart(obpm, dbpm, per);
}

/**
 * Mettre à jour une KPI card
 */
function updateKpiCard(id, value, metricName, impact) {
    const valueEl = document.getElementById(`advKpi${id}`);
    const impactEl = document.getElementById(`advKpi${id}Impact`);
    
    if (valueEl) valueEl.textContent = value;
    if (impactEl) impactEl.textContent = impact;
}

/**
 * Mettre à jour le chart horizontal des stats avancées
 */
function updateAdvancedChart(astTov, per, bpm, obpm, dbpm, ws) {
    // Valeurs brutes pour affichage
    const rawValues = [astTov || 0, per || 0, bpm || 0, obpm || 0, dbpm || 0, ws || 0];
    
    const labels = ['AST/TOV', 'PER', 'BPM', 'OBPM', 'DBPM', 'Win Shares'];
    
    // Calculer les min/max pour chaque groupe de métriques
    // Grouper les métriques par type pour une meilleure échelle
    const positiveMetrics = [astTov, per, ws]; // Toujours positifs
    const bpmMetrics = [bpm, obpm, dbpm]; // Peuvent être négatifs
    
    // Calculer l'échelle pour les métriques positives
    const maxPositive = Math.max(...positiveMetrics.filter(v => v > 0), 1);
    const positiveMax = Math.ceil(maxPositive * 1.2); // 20% de marge
    
    // Calculer l'échelle pour les BPM (symétriques autour de 0)
    const maxAbsBPM = Math.max(...bpmMetrics.map(v => Math.abs(v)), 1);
    const bpmMax = Math.ceil(maxAbsBPM * 1.2);
    const bpmMin = -bpmMax;
    
    // L'échelle globale doit accommoder les deux
    const overallMin = Math.min(-bpmMax, 0);
    const overallMax = positiveMax;
    
    const ctx = document.getElementById('advancedChart');
    if (!ctx) return;
    
    if (advancedChart) {
        advancedChart.data.labels = labels;
        advancedChart.data.datasets[0].data = rawValues;
        advancedChart.options.scales.x.min = overallMin;
        advancedChart.options.scales.x.max = overallMax;
        
        // Ajouter une ligne de référence à 0 pour les BPM
        if (!advancedChart.options.plugins.filler) {
            advancedChart.options.plugins.filler = {
                propagate: true
            };
        }
        
        advancedChart.update();
    } else {
        advancedChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Valeurs',
                    data: rawValues,
                    backgroundColor: function(context) {
                        const index = context.dataIndex;
                        // Couleurs différentes pour les BPM
                        if (index >= 2 && index <= 4) {
                            return 'rgba(100, 150, 220, 0.7)'; // Bleu plus clair pour BPM
                        }
                        return 'rgba(0, 102, 204, 0.7)'; // Bleu standard
                    },
                    borderColor: function(context) {
                        const index = context.dataIndex;
                        if (index >= 2 && index <= 4) {
                            return 'rgba(100, 150, 220, 1)';
                        }
                        return 'rgba(0, 102, 204, 1)';
                    },
                    borderWidth: 1.5,
                    borderRadius: 6,
                    barThickness: 18
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        font: { family: "'Inter Tight', sans-serif", size: 11, weight: 'bold' },
                        color: 'rgba(26, 26, 26, 0.8)',
                        offset: 8,
                        formatter: function(value, context) {
                            return value.toFixed(1);
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                const metricName = labels[idx];
                                const value = rawValues[idx];
                                let info = `${metricName}: ${value.toFixed(1)}`;
                                
                                // Ajouter un contexte pour les métriques spéciales
                                if (idx >= 2 && idx <= 4) {
                                    info += ' (BPM - peut être négatif)';
                                }
                                return info;
                            }
                        },
                        backgroundColor: 'rgba(26, 26, 26, 0.95)',
                        titleFont: { family: "'Inter Tight', sans-serif", size: 12 },
                        bodyFont: { family: "'Inter Tight', sans-serif", size: 11 }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        beginAtZero: true,
                        min: overallMin,
                        max: overallMax,
                        ticks: {
                            font: { family: "'Inter Tight', sans-serif", size: 10 },
                            callback: function(value) {
                                return value.toFixed(0);
                            },
                            // Afficher des lignes à intervalles réguliers
                            stepSize: Math.ceil((overallMax - overallMin) / 5)
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: true
                        }
                    },
                    y: {
                        ticks: {
                            font: { family: "'Inter Tight', sans-serif", size: 11, weight: 600 },
                            color: 'rgba(0, 0, 0, 0.7)'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
}

/**
 * Mettre à jour le chart doughnut Offensif/Défensif
 */
function updateOffDefChart(obpm, dbpm, per) {
    // Calculer les scores offensifs et défensifs
    const offensiveScore = Math.max(0, (obpm || 0) + (per || 0) / 10);
    const defensiveScore = Math.max(0, (dbpm || 0) + 2);
    
    // Normaliser pour que le total soit 100
    const total = offensiveScore + defensiveScore || 1;
    const offensivePercent = (offensiveScore / total) * 100;
    const defensivePercent = (defensiveScore / total) * 100;
    
    const ctx = document.getElementById('offDefChart');
    if (!ctx) return;
    
    if (offDefChart) {
        offDefChart.data.datasets[0].data = [offensivePercent, defensivePercent];
        offDefChart.update();
    } else {
        offDefChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Offensif', 'Défensif'],
                datasets: [{
                    data: [offensivePercent, defensivePercent],
                    backgroundColor: [
                        'rgba(255, 165, 0, 0.8)',  // Orange pour l'offensif
                        'rgba(52, 211, 153, 0.8)'   // Vert pour la défense
                    ],
                    borderColor: [
                        'rgba(255, 165, 0, 1)',
                        'rgba(52, 211, 153, 1)'
                    ],
                    borderWidth: 2,
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: { family: "'Inter Tight', sans-serif", size: 12, weight: 600 },
                            padding: 20,
                            boxWidth: 15
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: { family: "'Inter Tight', sans-serif", size: 12, weight: 'bold' },
                        formatter: function(value) {
                            return value.toFixed(1) + '%';
                        },
                        anchor: 'center',
                        align: 'center'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return label + ': ' + value.toFixed(1) + '%';
                            }
                        },
                        backgroundColor: 'rgba(26, 26, 26, 0.95)',
                        titleFont: { family: "'Inter Tight', sans-serif", size: 12 },
                        bodyFont: { family: "'Inter Tight', sans-serif", size: 11 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    
    // Ajouter le listener pour le easter egg du monogramme
    const monogramme = document.querySelector('.monogramme-corner');
    if (monogramme) {
        monogramme.addEventListener('click', triggerMoneyRain);
    }
    
    // Observer pour mettre à jour l'état de la sidebar au scroll
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id;
                const link = document.querySelector(`[data-section="${sectionId}"]`);
                if (link) updateSidebarActive(link);
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.section').forEach(section => {
        observer.observe(section);
    });
});

// Close modal when clicking outside
document.getElementById('playerModal').addEventListener('click', (e) => {
    if (e.target.id === 'playerModal') {
        closePlayerModal();
    }
});

// ==================== COURT INTERACTIVITY ====================

/**
 * Initialiser l'interactivité du terrain
 */
function initializeCourtInteractivity() {
    const zone2pPath = document.getElementById('zone2p-path');
    const zone3pPath = document.getElementById('zone3p-path');
    const tooltip = document.getElementById('tooltip');
    
    if (!zone2pPath || !zone3pPath || !tooltip) {
        console.warn('Court interactive elements not found');
        return;
    }
    
    // Événements pour la zone 2 points
    zone2pPath.addEventListener('mouseenter', (e) => {
        if (!selectedPlayer) return;
        showCourtTooltip(e, '2-points', tooltip);
        zone2pPath.style.fill = 'rgba(0, 102, 204, 0.2)';
    });
    
    zone2pPath.addEventListener('mousemove', (e) => {
        moveTooltip(e, tooltip);
    });
    
    zone2pPath.addEventListener('mouseleave', () => {
        hideCourtTooltip(tooltip);
        zone2pPath.style.fill = 'rgba(0, 102, 204, 0)';
    });
    
    // Événements pour la zone 3 points
    zone3pPath.addEventListener('mouseenter', (e) => {
        if (!selectedPlayer) return;
        showCourtTooltip(e, '3-points', tooltip);
        zone3pPath.style.fill = 'rgba(0, 102, 204, 0.2)';
    });
    
    zone3pPath.addEventListener('mousemove', (e) => {
        moveTooltip(e, tooltip);
    });
    
    zone3pPath.addEventListener('mouseleave', () => {
        hideCourtTooltip(tooltip);
        zone3pPath.style.fill = 'rgba(0, 102, 204, 0)';
    });
}

/**
 * Afficher le tooltip avec les données du joueur
 */
function showCourtTooltip(event, zone, tooltip) {
    if (!selectedPlayer) return;
    
    let content = '';
    
    if (zone === '2-points') {
        const attempts = toNumberFR(selectedPlayer.TwoPA_per_game) || 0;
        const percentage = toPercent(selectedPlayer.TwoP_Pct) || 0;
        content = `
            <div class="tooltip-content">
                <div class="tooltip-title">Tirs à 2 points</div>
                <div class="tooltip-stat">Tentatives: <strong>${attempts.toFixed(1)}</strong>/match</div>
                <div class="tooltip-stat">Réussite: <strong>${percentage.toFixed(1)}%</strong></div>
            </div>
        `;
    } else if (zone === '3-points') {
        const attempts = toNumberFR(selectedPlayer.ThreePA_per_game) || 0;
        const percentage = toPercent(selectedPlayer.ThreeP_Pct) || 0;
        content = `
            <div class="tooltip-content">
                <div class="tooltip-title">Tirs à 3 points</div>
                <div class="tooltip-stat">Tentatives: <strong>${attempts.toFixed(1)}</strong>/match</div>
                <div class="tooltip-stat">Réussite: <strong>${percentage.toFixed(1)}%</strong></div>
            </div>
        `;
    }
    
    tooltip.innerHTML = content;
    tooltip.classList.add('visible');
    moveTooltip(event, tooltip);
}

/**
 * Déplacer le tooltip avec la souris
 */
function moveTooltip(event, tooltip) {
    const offsetX = 15;
    const offsetY = 15;
    tooltip.style.left = (event.clientX + offsetX) + 'px';
    tooltip.style.top = (event.clientY + offsetY) + 'px';
}

/**
 * Masquer le tooltip
 */
function hideCourtTooltip(tooltip) {
    tooltip.classList.remove('visible');
    tooltip.innerHTML = '';
}

// ============================================================================
// EASTER EGG - Money Rain Animation
// ============================================================================

/**
 * Créer et animer un billet de monnaie
 */
function createMoneyBill(startX, startY) {
    const bill = document.createElement('div');
    bill.className = 'money-bill falling';
    
    // Utiliser différents symboles et couleurs pour plus de variété
    const billSymbols = ['💵', '💴', '💶', '💷'];
    const randomSymbol = billSymbols[Math.floor(Math.random() * billSymbols.length)];
    
    bill.textContent = randomSymbol;
    bill.style.left = startX + 'px';
    bill.style.top = startY + 'px';
    
    // Ajouter une rotation aléatoire initiale
    const randomRotation = Math.random() * 360;
    bill.style.transform = `rotateZ(${randomRotation}deg)`;
    
    // Variation aléatoire horizontale pendant la chute
    const randomOffset = (Math.random() - 0.5) * 400; // Entre -200 et 200px
    
    document.body.appendChild(bill);
    
    // Animer avec une trajectoire légèrement ondulée
    const animation = bill.animate([
        {
            transform: `translateY(0) rotateZ(${randomRotation}deg) translateX(0)`,
            opacity: 1
        },
        {
            transform: `translateY(${window.innerHeight}px) rotateZ(${randomRotation + 720}deg) translateX(${randomOffset})`,
            opacity: 0
        }
    ], {
        duration: 3000 + Math.random() * 1000, // Entre 3 et 4 secondes
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    // Supprimer l'élément après l'animation
    animation.onfinish = () => {
        bill.remove();
    };
}

/**
 * Déclencher la pluie de billets
 */
function triggerMoneyRain() {
    const monogramme = document.querySelector('.monogramme-corner');
    if (!monogramme) return;
    
    // Obtenir la position du monogramme
    const rect = monogramme.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    
    // Créer plusieurs billets en cascade
    const billCount = 15;
    for (let i = 0; i < billCount; i++) {
        setTimeout(() => {
            // Variation aléatoire du point de départ horizontal
            const xVariation = (Math.random() - 0.5) * 100;
            createMoneyBill(startX + xVariation, startY);
        }, i * 100); // Délai échelonné entre chaque billet
    }
    
    // Effet visuel supplémentaire : faire bouger le monogramme
    monogramme.style.animation = 'none';
    setTimeout(() => {
        monogramme.style.transform = 'scale(1.1) rotate(-5deg)';
    }, 50);
    
    setTimeout(() => {
        monogramme.style.transform = 'scale(1) rotate(0deg)';
    }, 150);
}
