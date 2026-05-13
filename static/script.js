// ================= GLOBAL =================
let allComponents = {};
let buildsCache = [];
let editingBuildId = null;
let currentEditingBuild = null;

// ================= LOAD COMPONENTS =================
async function loadComponents() {

    try {

        const res = await fetch('/api/components');

        allComponents = await res.json();

        console.log("components loaded", allComponents);

    } catch (e) {

        console.error(e);

        alert("Ошибка загрузки компонентов");
    }
}

// ================= USER =================
function getUserId() {

    let id = localStorage.getItem("pc_user_id");

    if (!id) {

        id = "user_" + Math.random().toString(36).slice(2, 12);

        localStorage.setItem("pc_user_id", id);
    }

    return id;
}

// ================= HELPERS =================
function getPlatform() {

    return document.querySelector(
        'input[name="platform"]:checked'
    )?.value || "any";
}

function pickBest(list, maxPrice) {

    if (!list || !list.length) return null;

    const filtered = list
        .filter(x => x.price <= maxPrice)
        .sort((a, b) => b.price - a.price);

    return filtered[0] || null;
}

function findClosest(list, target) {

    if (!list || !list.length) return null;

    return [...list].sort((a, b) => {

        return Math.abs(a.price - target)
            - Math.abs(b.price - target);

    })[0];
}

function getSocket(specs = "") {

    if (specs.includes("AM5")) return "AM5";
    if (specs.includes("AM4")) return "AM4";

    if (specs.includes("LGA1700")) return "LGA1700";
    if (specs.includes("LGA1200")) return "LGA1200";

    return "";
}

function getRamType(specs = "") {

    if (specs.includes("DDR5")) return "DDR5";
    if (specs.includes("DDR4")) return "DDR4";

    return "";
}

function findByName(list = [], name) {

    return list.find(x => x.name === name);
}

// ================= FPS =================
// ================= FPS =================
function estimateFPS(cpuName = "", gpuName = "", purpose = "gaming") {

    cpuName = cpuName.toLowerCase();
    gpuName = gpuName.toLowerCase();

    if (purpose !== "gaming") {

        return {
            cs2: "—",
            gta5: "—",
            dota2: "—"
        };
    }

    let gpuScore = 0;
    let cpuScore = 0;

    // ================= GPU SCORE =================

    // ULTRA
    if (
        gpuName.includes("5090") ||
        gpuName.includes("5080") ||
        gpuName.includes("4090")
    ) {
        gpuScore = 10;
    }

    // HIGH
    else if (
        gpuName.includes("4080") ||
        gpuName.includes("4070 ti") ||
        gpuName.includes("7900")
    ) {
        gpuScore = 9;
    }

    // GOOD
    else if (
        gpuName.includes("4070") ||
        gpuName.includes("7800") ||
        gpuName.includes("7700 xt")
    ) {
        gpuScore = 8;
    }

    // MID+
    else if (
        gpuName.includes("4060 ti") ||
        gpuName.includes("3070") ||
        gpuName.includes("6800")
    ) {
        gpuScore = 7;
    }

    // MID
    else if (
        gpuName.includes("4060") ||
        gpuName.includes("3060") ||
        gpuName.includes("6700") ||
        gpuName.includes("7600")
    ) {
        gpuScore = 6;
    }

    // LOW+
    else if (
        gpuName.includes("3050") ||
        gpuName.includes("6600")
    ) {
        gpuScore = 5;
    }

    // LOW
    else if (
        gpuName.includes("2060") ||
        gpuName.includes("1660")
    ) {
        gpuScore = 4;
    }

    else {
        gpuScore = 3;
    }

    // ================= CPU SCORE =================

    // TOP
    if (
        cpuName.includes("7800x3d") ||
        cpuName.includes("14900") ||
        cpuName.includes("14700")
    ) {
        cpuScore = 10;
    }

    // HIGH
    else if (
        cpuName.includes("14600") ||
        cpuName.includes("13700") ||
        cpuName.includes("7700")
    ) {
        cpuScore = 8;
    }

    // GOOD
    else if (
        cpuName.includes("13600") ||
        cpuName.includes("7600") ||
        cpuName.includes("5800x")
    ) {
        cpuScore = 7;
    }

    // MID
    else if (
        cpuName.includes("5600") ||
        cpuName.includes("12400") ||
        cpuName.includes("5700")
    ) {
        cpuScore = 6;
    }

    // LOW
    else if (
        cpuName.includes("5500") ||
        cpuName.includes("10400")
    ) {
        cpuScore = 4;
    }

    else {
        cpuScore = 3;
    }

    // ================= FINAL FPS =================

    const cs2 =
        Math.round((gpuScore * 25) + (cpuScore * 18));

    const gta5 =
        Math.round((gpuScore * 18) + (cpuScore * 8));

    const dota2 =
        Math.round((gpuScore * 20) + (cpuScore * 16));

    return {
        cs2: `${cs2} FPS`,
        gta5: `${gta5} FPS`,
        dota2: `${dota2} FPS`
    };
}

// ================= COMPATIBILITY =================
function checkCompatibility(cpu, mobo, ram) {

    let problems = [];

    const cpuSocket = getSocket(cpu?.specs || "");
    const moboSocket = getSocket(mobo?.specs || "");

    const ramType = getRamType(ram?.specs || "");

    if (
        cpuSocket &&
        moboSocket &&
        cpuSocket !== moboSocket
    ) {

        problems.push(
            `❌ Сокет CPU (${cpuSocket}) не подходит к материнке (${moboSocket})`
        );
    }

    if (
        ramType === "DDR5"
        &&
        !mobo?.specs?.includes("DDR5")
    ) {

        problems.push(
            `❌ DDR5 память не поддерживается материнкой`
        );
    }

    if (
        ramType === "DDR4"
        &&
        mobo?.specs?.includes("DDR5")
    ) {

        problems.push(
            `❌ DDR4 память не подходит к DDR5 материнке`
        );
    }

    return problems;
}

// ================= GENERATE BUILDS =================
function generateBuilds() {

    const purpose = document.getElementById('purpose').value;
    const budget = parseInt(document.getElementById('budget').value);

    let cpus = allComponents.cpu || [];
    let gpus = allComponents.gpu || [];
    let rams = allComponents.ram || [];
    let mobos = allComponents.motherboard || [];
    let psus = allComponents.psu || [];

    const platform = getPlatform();

    // PLATFORM FILTER
    if (platform !== "any") {
        cpus = cpus.filter(x => x.platform === platform || x.platform === "any");
    }

    // PURPOSE RATIOS
    let cpuShare = 0.28;
    let gpuShare = 0.42;
    let ramShare = 0.12;

    if (purpose === "video") {
        cpuShare = 0.35; gpuShare = 0.35; ramShare = 0.15;
    }
    if (purpose === "office") {
        cpuShare = 0.35; gpuShare = 0.10; ramShare = 0.15;
    }

    const cpuCandidates = cpus.filter(x => x.price <= budget * cpuShare * 1.5);
    const gpuCandidates = purpose === "office" 
        ? [{ name: "Встроенная графика", price: 0, specs: "iGPU" }]
        : gpus.filter(x => x.price <= budget * gpuShare * 1.5);

    const builds = [];

    for (const cpu of cpuCandidates) {
        for (const gpu of gpuCandidates) {

            const socket = getSocket(cpu.specs);
            let motherboardPool = mobos.filter(m => m.specs.includes(socket));
            if (!motherboardPool.length) continue;

            const motherboard = pickBest(motherboardPool, budget * 0.15) || motherboardPool[0];
            if (!motherboard) continue;

            const ramType = motherboard.specs.includes("DDR5") ? "DDR5" : "DDR4";
            const ramPool = rams.filter(r => r.specs.includes(ramType));
            const ram = findClosest(ramPool, budget * ramShare);
            if (!ram) continue;

            // PSU selection
            let psu;
            if (gpu.price >= 120000) psu = psus.find(x => x.name.includes("850"));
            else if (gpu.price >= 70000) psu = psus.find(x => x.name.includes("750"));
            else if (gpu.price >= 35000) psu = psus.find(x => x.name.includes("650"));
            else psu = psus.find(x => x.name.includes("550"));

            if (!psu) psu = psus[0];
            if (!psu) continue;

            const total = cpu.price + gpu.price + ram.price + motherboard.price + psu.price;

            if (total < budget * 0.70 || total > budget) continue;

            const problems = checkCompatibility(cpu, motherboard, ram);
            if (problems.length) continue;

            // ================= УЛУЧШЕННЫЙ РАСЧЁТ FPS =================
            const fps = calculateFPS(cpu, gpu, purpose, budget);

            builds.push({
                name: `${purpose.toUpperCase()} BUILD`,
                cpu,
                gpu,
                ram,
                mobo: motherboard,
                psu,
                total: Math.round(total),
                fps: {
                    cs2: `${fps.cs2} FPS`,
                    gta5: `${fps.gta5} FPS`,
                    dota2: `${fps.dota2} FPS`
                }
            });
        }
    }

    // Убираем дубли
    const uniqueBuilds = [];
    builds.forEach(b => {
        const exists = uniqueBuilds.find(x =>
            x.cpu.name === b.cpu.name &&
            x.gpu.name === b.gpu.name &&
            x.ram.name === b.ram.name
        );
        if (!exists) uniqueBuilds.push(b);
    });

    uniqueBuilds.sort((a, b) => a.total - b.total);
    buildsCache = uniqueBuilds;
    renderBuilds(uniqueBuilds);
}

function calculateFPS(cpu, gpu, purpose, budget) {
    const cpuName = cpu.name.toLowerCase();
    const gpuName = gpu.name.toLowerCase();

    // === GPU SCORE (0-100) ===
    let gpuScore = 35; // базовый уровень

    if (gpuName.includes("5090") || gpuName.includes("4090")) gpuScore = 98;
    else if (gpuName.includes("5080") || gpuName.includes("4080")) gpuScore = 88;
    else if (gpuName.includes("5070") || gpuName.includes("4070 ti")) gpuScore = 78;
    else if (gpuName.includes("4070")) gpuScore = 72;
    else if (gpuName.includes("4060 ti")) gpuScore = 62;
    else if (gpuName.includes("4060")) gpuScore = 55;
    else if (gpuName.includes("7900 xtx")) gpuScore = 85;
    else if (gpuName.includes("7900 xt")) gpuScore = 78;
    else if (gpuName.includes("7800 xt")) gpuScore = 70;
    else if (gpuName.includes("7600")) gpuScore = 58;
    else if (gpuName.includes("6600")) gpuScore = 52;
    else if (gpuName.includes("3060")) gpuScore = 50;

    // === CPU SCORE (0-100) ===
    let cpuScore = 40;

    if (cpuName.includes("7800x3d")) cpuScore = 95;
    else if (cpuName.includes("9800x3d") || cpuName.includes("14900k")) cpuScore = 92;
    else if (cpuName.includes("14700")) cpuScore = 85;
    else if (cpuName.includes("7700") || cpuName.includes("13700")) cpuScore = 78;
    else if (cpuName.includes("7600") || cpuName.includes("13600")) cpuScore = 72;
    else if (cpuName.includes("5700x3d")) cpuScore = 68;
    else if (cpuName.includes("12400") || cpuName.includes("5600")) cpuScore = 58;
    else if (cpuName.includes("13400") || cpuName.includes("12400f")) cpuScore = 55;

    // Учёт bottleneck
    let bottleneck = 0;
    if (cpuScore < gpuScore - 15) {
        bottleneck = Math.floor((gpuScore - cpuScore - 15) * 0.45);
    }

    // Базовый FPS (с учётом бюджета)
    const budgetFactor = Math.min(1.35, Math.max(0.75, budget / 120000));

    let baseFPS = Math.round((gpuScore * 1.8 + cpuScore * 0.9) * budgetFactor);

    // Разные игры
    const cs2 = Math.max(70, Math.round(baseFPS * 1.45 - bottleneck * 1.1));
    const gta5 = Math.max(55, Math.round(baseFPS * 0.92 - bottleneck * 0.7));
    const dota2 = Math.max(80, Math.round(baseFPS * 1.25 - bottleneck * 0.4));

    return {    
        cs2: cs2,
        gta5: gta5,
        dota2: dota2
    };
}

// ================= RENDER =================
function renderBuilds(builds) {

    const el =
        document.getElementById('results');

    if (!builds.length) {

        el.innerHTML = `

            <div class="alert alert-warning">

                Не удалось подобрать сборку
                под этот бюджет

            </div>
        `;

        return;
    }

    el.innerHTML = builds.map((b, i) => `

        <div class="build-card">

            <h4>${b.name}</h4>

            <div class="specs-list">

                <div class="spec-item">
                    <i class="bi bi-cpu"></i>
                    <span>CPU: ${b.cpu.name}</span>
                </div>

                <div class="spec-item">
                    <i class="bi bi-gpu-card"></i>
                    <span>GPU: ${b.gpu.name}</span>
                </div>

                <div class="spec-item">
                    <i class="bi bi-memory"></i>
                    <span>RAM: ${b.ram.name}</span>
                </div>

                <div class="spec-item">
                    <i class="bi bi-motherboard"></i>
                    <span>MB: ${b.mobo.name}</span>
                </div>

                <div class="spec-item">
                    <i class="bi bi-plugin"></i>
                    <span>PSU: ${b.psu.name}</span>
                </div>

            </div>

            <div class="price mt-3">

                ${b.total.toLocaleString('ru-RU')} ₽

            </div>

            <!-- FPS TOGGLE -->

            <div class="fps-dropdown">

                <button
                    class="fps-toggle"
                    onclick="toggleFPS(${i})"
                >

                    <div class="fps-toggle-left">

                        <i class="bi bi-bar-chart-line"></i>

                        <span>
                            Предполагаемый FPS
                        </span>

                    </div>

                    <i
                        id="fps-arrow-${i}"
                        class="bi bi-chevron-down"
                    ></i>

                </button>

                <div
                    class="fps-content"
                    id="fps-content-${i}"
                >

                    <!-- CS2 -->

                    <div class="fps-game">

                        <div class="fps-game-left">

                            <img
                                class="game-logo"
                                src="https://tse1.mm.bing.net/th/id/OIP.bRnOPkGchi-9lUJIYiCUZAAAAA?cb=thfc1&rs=1&pid=ImgDetMain&o=7&rm=3"
                            >

                            <span>CS2</span>

                        </div>

                        <div class="fps-value">
                            ${b.fps.cs2}
                        </div>

                    </div>

                    <!-- GTA -->

                    <div class="fps-game">

                        <div class="fps-game-left">

                            <img
                                class="game-logo"
                               src="https://gameshost.games/GTA5/icon.ico"
                            >

                            <span>GTA V</span>

                        </div>

                        <div class="fps-value">
                            ${b.fps.gta5}
                        </div>

                    </div>

                    <!-- DOTA -->

                    <div class="fps-game">

                        <div class="fps-game-left">

                            <img
                                class="game-logo"
                              src="https://fonzon.club/uploads/posts/2022-01/thumbs/1643355923_24-fonzon-club-p-dota-2-logotip-bez-fona-49.png"
                            >

                            <span>Dota 2</span>

                        </div>

                        <div class="fps-value">
                            ${b.fps.dota2}
                        </div>

                    </div>

                </div>

            </div>

            <!-- BUTTONS -->

            <button
                onclick="saveBuild(${i})"
                class="btn btn-success save-btn mt-3"
            >

                <i class="bi bi-floppy"></i>

                Сохранить

            </button>

            <button
                onclick="openEditorFromGenerated(${i})"
                class="btn btn-outline-primary edit-btn mt-2"
            >

                <i class="bi bi-pencil-square"></i>

                Редактировать

            </button>

        </div>

    `).join('');
}

// ================= SAVE =================
async function saveBuild(i) {

    const b = buildsCache[i];

    if (!b) return;

    const userId = getUserId();

    await fetch('/api/save', {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({

            user_id: userId,

            purpose:
                document.getElementById(
                    'purpose'
                ).value,

            budget:
                parseInt(
                    document.getElementById(
                        'budget'
                    ).value
                ),

            components: {

                cpu: b.cpu.name,

                gpu: b.gpu.name,

                ram: b.ram.name,

                motherboard: b.mobo.name,

                psu: b.psu.name
            },

            total: b.total
        })
    });

    alert("Сборка сохранена");
}

// ================= MY BUILDS =================
async function showMyBuilds() {

    const userId = getUserId();

    const res =
        await fetch('/api/mybuilds/' + userId);

    const builds = await res.json();

    const el =
        document.getElementById('builds-list');

    if (!builds.length) {

        el.innerHTML = `
            <div class="text-muted">
                Нет сохранённых сборок
            </div>
        `;

    } else {

        el.innerHTML = builds.map(b => `

            <div class="build-card mb-3">

                <b>${b.purpose}</b><br><br>

                CPU: ${b.components.cpu}<br>

                GPU: ${b.components.gpu}<br>

                RAM: ${b.components.ram}<br>

                MB: ${b.components.motherboard}<br>

                PSU: ${b.components.psu}<br>

                <div class="price mt-2">

                    ${b.total.toLocaleString('ru-RU')} ₽

                </div>

                <button
                    onclick="editSavedBuild(${b.id})"
                    class="btn btn-outline-primary btn-sm mt-2"
                >
                    Редактировать
                </button>

                <button
                    onclick="deleteBuild(${b.id})"
                    class="btn btn-danger btn-sm mt-2"
                >
                    Удалить
                </button>

            </div>

        `).join('');
    }

    new bootstrap.Modal(
        document.getElementById('myBuildsModal')
    ).show();
}

// ================= DELETE =================
async function deleteBuild(id) {

    await fetch('/api/delete_build', {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({ id })
    });

    const modalEl =
        document.getElementById(
            'myBuildsModal'
        );

    const modal =
        bootstrap.Modal.getInstance(modalEl);

    if (modal) {

        modal.hide();
    }

    document
        .querySelectorAll('.modal-backdrop')
        .forEach(x => x.remove());

    document.body.classList.remove('modal-open');

    document.body.style = '';

    setTimeout(() => {

        showMyBuilds();

    }, 150);
}

// ================= OPEN EDITOR GENERATED =================
function openEditorFromGenerated(i) {

    const b = buildsCache[i];

    currentEditingBuild = {

        cpu: b.cpu.name,

        gpu: b.gpu.name,

        ram: b.ram.name,

        motherboard: b.mobo.name,

        psu: b.psu.name
    };

    editingBuildId = null;

    fillEditor();
}

// ================= OPEN EDITOR SAVED =================
async function editSavedBuild(id) {

    const userId = getUserId();

    const res =
        await fetch('/api/mybuilds/' + userId);

    const builds = await res.json();

    const build =
        builds.find(x => x.id === id);

    if (!build) return;

    currentEditingBuild = build.components;

    editingBuildId = id;

    fillEditor();
}

// ================= FILL EDITOR =================
function fillEditor() {

    fillSelect(
        "edit-cpu",
        allComponents.cpu,
        currentEditingBuild.cpu
    );

    fillSelect(
        "edit-gpu",
        allComponents.gpu,
        currentEditingBuild.gpu
    );

    fillSelect(
        "edit-ram",
        allComponents.ram,
        currentEditingBuild.ram
    );

    fillSelect(
        "edit-mobo",
        allComponents.motherboard,
        currentEditingBuild.motherboard
    );

    fillSelect(
        "edit-psu",
        allComponents.psu,
        currentEditingBuild.psu
    );

    updateEditorPrice();

    new bootstrap.Modal(
        document.getElementById('editorModal')
    ).show();
}

// ================= SELECTS =================
function fillSelect(id, list, selected) {

    const sel =
        document.getElementById(id);

    sel.innerHTML = "";

    list.forEach(x => {

        const opt =
            document.createElement("option");

        opt.value = x.name;

        opt.textContent =
            `${x.name} (${x.price.toLocaleString('ru-RU')} ₽)`;

        if (x.name === selected) {

            opt.selected = true;
        }

        sel.appendChild(opt);
    });

    sel.onchange = updateEditorPrice;
}

// ================= UPDATE PRICE =================
function updateEditorPrice() {

    const cpu =
        findByName(
            allComponents.cpu,
            document.getElementById(
                'edit-cpu'
            ).value
        );

    const gpu =
        findByName(
            allComponents.gpu,
            document.getElementById(
                'edit-gpu'
            ).value
        );

    const ram =
        findByName(
            allComponents.ram,
            document.getElementById(
                'edit-ram'
            ).value
        );

    const mobo =
        findByName(
            allComponents.motherboard,
            document.getElementById(
                'edit-mobo'
            ).value
        );

    const psu =
        findByName(
            allComponents.psu,
            document.getElementById(
                'edit-psu'
            ).value
        );

    const total =

        (cpu?.price || 0)
        +
        (gpu?.price || 0)
        +
        (ram?.price || 0)
        +
        (mobo?.price || 0)
        +
        (psu?.price || 0);

    document.getElementById(
        'edit-total'
    ).innerText =

        total.toLocaleString('ru-RU')
        +
        " ₽";

    const problems =
        checkCompatibility(
            cpu,
            mobo,
            ram
        );

    const compatEl =
        document.getElementById(
            'compatibility-box'
        );

    if (!problems.length) {

        compatEl.innerHTML = `

            <div class="alert alert-success">

                ✅ Все комплектующие совместимы

            </div>
        `;

    } else {

        compatEl.innerHTML = `

            <div class="alert alert-danger">

                ${problems.join("<br>")}

            </div>
        `;
    }

    window.editedBuild = {

        cpu,
        gpu,
        ram,
        mobo,
        psu,
        total
    };
}

// ================= SAVE EDITED =================
async function saveEditedBuild() {

    const b = window.editedBuild;

    if (!b) return;

    const compatibility =
        checkCompatibility(
            b.cpu,
            b.mobo,
            b.ram
        );

    if (compatibility.length) {

        alert(
            "Нельзя сохранить несовместимую сборку:\n\n"
            +
            compatibility.join("\n")
        );

        return;
    }

    const userId = getUserId();

    // UPDATE
    if (editingBuildId) {

        await fetch('/api/update_build', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({

                id: editingBuildId,

                purpose:
                    document.getElementById(
                        'purpose'
                    ).value,

                budget:
                    parseInt(
                        document.getElementById(
                            'budget'
                        ).value
                    ),

                components: {

                    cpu: b.cpu.name,

                    gpu: b.gpu.name,

                    ram: b.ram.name,

                    motherboard: b.mobo.name,

                    psu: b.psu.name
                },

                total: b.total
            })
        });

        alert("Сборка обновлена");

    } else {

        // SAVE NEW
        await fetch('/api/save', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({

                user_id: userId,

                purpose:
                    document.getElementById(
                        'purpose'
                    ).value,

                budget:
                    parseInt(
                        document.getElementById(
                            'budget'
                        ).value
                    ),

                components: {

                    cpu: b.cpu.name,

                    gpu: b.gpu.name,

                    ram: b.ram.name,

                    motherboard: b.mobo.name,

                    psu: b.psu.name
                },

                total: b.total
            })
        });

        alert("Сборка сохранена");
    }

    const editor =
        bootstrap.Modal.getInstance(
            document.getElementById('editorModal')
        );

    if (editor) {

        editor.hide();
    }

    setTimeout(() => {

        showMyBuilds();

    }, 200);
}

// ================= BUDGET PRESETS =================
function setBudget(value) {

    const slider =
        document.getElementById('budget');

    slider.value = value;

    document.getElementById(
        'budget-value'
    ).textContent =

        parseInt(value)
            .toLocaleString('ru-RU')
        +
        " ₽";
}
// ================= FPS TOGGLE =================
function toggleFPS(i) {

    const content =
        document.getElementById(`fps-content-${i}`);

    const arrow =
        document.getElementById(`fps-arrow-${i}`);

    if (
        content.style.display === "block"
    ) {

        content.style.display = "none";

        arrow.className =
            "bi bi-chevron-down";

    } else {

        content.style.display = "block";

        arrow.className =
            "bi bi-chevron-up";
    }
}

// ================= INIT =================
window.onload = async () => {

    await loadComponents();

    const slider =
        document.getElementById('budget');

    const label =
        document.getElementById(
            'budget-value'
        );

    label.textContent =

        parseInt(slider.value)
            .toLocaleString('ru-RU')
        +
        " ₽";

    slider.oninput = () => {

        label.textContent =

            parseInt(slider.value)
                .toLocaleString('ru-RU')
            +
            " ₽";
    };
};