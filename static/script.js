// ================= GLOBAL =================
let allComponents = {};
let buildsCache = [];
let editingBuildId = null;
let currentEditingBuild = null;

// ================= LOAD COMPONENTS =================
async function loadComponents() {

    const res = await fetch('/api/components');
    allComponents = await res.json();

    console.log("components loaded", allComponents);
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
    return document.querySelector('input[name="platform"]:checked')?.value || "any";
}

function pickBest(list, maxPrice) {

    if (!list || !list.length) return null;

    const filtered = list
        .filter(x => x.price <= maxPrice)
        .sort((a, b) => b.price - a.price);

    return filtered[0] || null;
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

function findByName(list, name) {
    return list.find(x => x.name === name);
}

// ================= COMPATIBILITY =================
function checkCompatibility(cpu, mobo, ram) {

    let problems = [];

    const cpuSocket = getSocket(cpu?.specs || "");
    const moboSocket = getSocket(mobo?.specs || "");

    const ramType = getRamType(ram?.specs || "");

    // CPU + motherboard
    if (cpuSocket !== moboSocket) {
        problems.push(`❌ Сокет CPU (${cpuSocket}) не подходит к материнке (${moboSocket})`);
    }

    // RAM check
    if (ramType === "DDR5" && !mobo.specs.includes("DDR5")) {
        problems.push(`❌ DDR5 память не поддерживается материнкой`);
    }

    if (ramType === "DDR4" && mobo.specs.includes("DDR5")) {
        problems.push(`❌ DDR4 память не подходит к DDR5 материнке`);
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

    if (platform !== "any") {
        cpus = cpus.filter(x =>
            x.platform === platform || x.platform === "any"
        );
    }

    const configs = [
        { name: "Бюджет", ratio: 0.85 },
        { name: "Баланс", ratio: 0.95 },
        { name: "Максимум", ratio: 1.0 }
    ];

    const builds = [];

    configs.forEach(cfg => {

        const target = budget * cfg.ratio;

        let cpuShare = 0.28;
        let gpuShare = 0.42;
        let ramShare = 0.12;

        if (purpose === "video") {
            cpuShare = 0.35;
            gpuShare = 0.35;
            ramShare = 0.15;
        }

        if (purpose === "office") {
            cpuShare = 0.35;
            gpuShare = 0.10;
            ramShare = 0.15;
        }

        // CPU
        const cpu = pickBest(cpus, target * cpuShare);

        if (!cpu) return;

        // Motherboard
        const socket = getSocket(cpu.specs);

        let motherboard = mobos.find(m =>
            m.specs.includes(socket)
        );

        if (!motherboard) return;

        // RAM
        const ramType = motherboard.specs.includes("DDR5")
            ? "DDR5"
            : "DDR4";

        let ramPool = rams.filter(r =>
            r.specs.includes(ramType)
        );

        const ram = pickBest(ramPool, target * ramShare);

        if (!ram) return;

        // GPU
        let gpu;

        if (purpose === "office") {

            gpu = {
                name: "Встроенная графика",
                price: 0,
                specs: "iGPU"
            };

        } else {

            gpu = pickBest(gpus, target * gpuShare);

            if (!gpu) return;
        }

        // PSU
        let psu;

        if (gpu.price >= 120000) {
            psu = psus.find(x => x.name.includes("850"));
        }
        else if (gpu.price >= 70000) {
            psu = psus.find(x => x.name.includes("750"));
        }
        else if (gpu.price >= 35000) {
            psu = psus.find(x => x.name.includes("650"));
        }
        else {
            psu = psus.find(x => x.name.includes("550"));
        }

        if (!psu) psu = psus[0];

        // TOTAL
        const total =
            cpu.price +
            gpu.price +
            ram.price +
            motherboard.price +
            psu.price;

        // LIMIT
        if (total > budget * 1.05) return;

        builds.push({
            name: `${cfg.name} сборка (${purpose})`,

            cpu,
            gpu,
            ram,
            mobo: motherboard,
            psu,

            total: Math.round(total)
        });
    });

    buildsCache = builds;

    renderBuilds(builds);
}

// ================= RENDER =================
function renderBuilds(builds) {

    const el = document.getElementById('results');

    if (!builds.length) {

        el.innerHTML = `
            <div class="alert alert-warning">
                Не удалось подобрать сборку под этот бюджет
            </div>
        `;

        return;
    }

    el.innerHTML = builds.map((b, i) => `

        <div class="build-card">

            <h4>${b.name}</h4>

            <div class="small">
                CPU: ${b.cpu.name}<br>
                GPU: ${b.gpu.name}<br>
                RAM: ${b.ram.name}<br>
                MB: ${b.mobo.name}<br>
                PSU: ${b.psu.name}
            </div>

            <div class="price">
                ${b.total.toLocaleString('ru-RU')} ₽
            </div>

            <button
                onclick="saveBuild(${i})"
                class="btn btn-success btn-sm mt-2"
            >
                Сохранить
            </button>

            <button
                onclick="openEditorFromGenerated(${i})"
                class="btn btn-outline-primary btn-sm mt-2"
            >
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

            purpose: document.getElementById('purpose').value,

            budget: parseInt(
                document.getElementById('budget').value
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

    const res = await fetch('/api/mybuilds/' + userId);

    const builds = await res.json();

    const el = document.getElementById('builds-list');

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

    showMyBuilds();
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

    const res = await fetch('/api/mybuilds/' + userId);

    const builds = await res.json();

    const build = builds.find(x => x.id === id);

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

    const sel = document.getElementById(id);

    sel.innerHTML = "";

    list.forEach(x => {

        const opt = document.createElement("option");

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

    const cpu = findByName(
        allComponents.cpu,
        document.getElementById('edit-cpu').value
    );

    const gpu = findByName(
        allComponents.gpu,
        document.getElementById('edit-gpu').value
    );

    const ram = findByName(
        allComponents.ram,
        document.getElementById('edit-ram').value
    );

    const mobo = findByName(
        allComponents.motherboard,
        document.getElementById('edit-mobo').value
    );

    const psu = findByName(
        allComponents.psu,
        document.getElementById('edit-psu').value
    );

    const total =
        (cpu?.price || 0) +
        (gpu?.price || 0) +
        (ram?.price || 0) +
        (mobo?.price || 0) +
        (psu?.price || 0);

    document.getElementById('edit-total').innerText =
        total.toLocaleString('ru-RU') + " ₽";

    // compatibility
    const problems = checkCompatibility(cpu, mobo, ram);

    let compatEl = document.getElementById('compatibility-box');

    if (!compatEl) {

        compatEl = document.createElement("div");

        compatEl.id = "compatibility-box";

        compatEl.style.marginTop = "15px";

        document.querySelector(".modal-body")
            .appendChild(compatEl);
    }

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

    const compatibility = checkCompatibility(
        b.cpu,
        b.mobo,
        b.ram
    );

    if (compatibility.length) {

        alert(
            "Нельзя сохранить несовместимую сборку:\n\n" +
            compatibility.join("\n")
        );

        return;
    }

    const userId = getUserId();

    // UPDATE EXISTING
    if (editingBuildId) {

        await fetch('/api/update_build', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: editingBuildId,

                purpose: document.getElementById('purpose').value,

                budget: parseInt(
                    document.getElementById('budget').value
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

                purpose: document.getElementById('purpose').value,

                budget: parseInt(
                    document.getElementById('budget').value
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

    showMyBuilds();
}

// ================= INIT =================
window.onload = async () => {

    await loadComponents();

    const slider = document.getElementById('budget');
    const label = document.getElementById('budget-value');

    label.textContent =
        parseInt(slider.value).toLocaleString('ru-RU') + " ₽";

    slider.oninput = () => {

        label.textContent =
            parseInt(slider.value).toLocaleString('ru-RU') + " ₽";
    };
};