"use strict";

const MASTER_FILE_DEFAULT = "MasterListDB.json";
const el = (id) => document.getElementById(id);

const ui = {
  globalStatus: el("globalStatus"),
  btnImport: el("btnImport"),
  btnExport: el("btnExport"),
  btnNew: el("btnNew"),
  fileInput: el("fileInput"),

  // Categories
  category: el("category"),
  ListOptions: el("ListOptions"),
  AddListOutput: el("AddListOutput"),
  categoriesTableBody: el("categoriesTableBody"),

  // addItemstoCategories
  categories_item: el("categories_item"),
  itemtoadd: el("itemtoadd"),
  NoList: el("NoList"),
  text_area2: el("text_area2"),

  // Categoryreport
  CatChoice: el("CatChoice"),
  cat_report: el("cat_report"),

  // edit_Item
  editCatChoice: el("editCatChoice"),
  editItemChoice: el("editItemChoice"),
  editNewItemInput: el("editNewItemInput"),
  editStatus: el("editStatus"),

  // Report
  text_area1: el("text_area1"),
};

let db = null;
let loadedFileName = null;

function normalize(s){ return String(s || "").trim(); }

function nowISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tzMin = d.getTimezoneOffset();
  const sign = tzMin <= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const tzh = pad(Math.floor(abs / 60));
  const tzm = pad(abs % 60);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${tzh}:${tzm}`;
}

function ensureDb(){
  if (!db) db = { schema: 1, version: 1, updatedAt: nowISO(), categories: [] };
}
function bumpVersion(){
  ensureDb();
  db.version = (Number(db.version) || 0) + 1;
  db.updatedAt = nowISO();
}

function setGlobalStatus(){
  if (!db) { ui.globalStatus.textContent = "No file loaded."; ui.btnExport.disabled = true; return; }
  ui.btnExport.disabled = false;
  const filePart = loadedFileName ? `Loaded: ${loadedFileName}` : "Working set (not imported)";
  ui.globalStatus.textContent = `${filePart} | v${db.version} | updated ${db.updatedAt} | categories ${db.categories.length}`;
}

function setText(id, value){ el(id).value = value; }
function getText(id){ return (el(id).value ?? ""); }
function setLabel(id, value){ el(id).textContent = value; }

function validateDb(candidate){
  if (!candidate || typeof candidate !== "object") return "File is not a JSON object.";
  if (!Array.isArray(candidate.categories)) return "Missing or invalid 'categories' array.";
  for (const row of candidate.categories) {
    if (!Array.isArray(row) || row.length < 1) return "Each category row must be an array with at least a category name.";
    if (typeof row[0] !== "string") return "Category name (index 0) must be a string.";
  }
  return null;
}

// ----- SPA screens -----
function showScreen(screenId){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}
function setScreen(screenId){ showScreen(screenId); }

// ----- onEvent port -----
function onEvent(id, eventName, handler){
  const node = el(id);
  if (node) node.addEventListener(eventName, handler);
}

// ----- Data helpers -----
function categoryNames(){
  ensureDb();
  return db.categories.map(r => r[0]);
}
function getCategoryIndexByName(name){
  ensureDb();
  const n = normalize(name).toLowerCase();
  for (let i=0;i<db.categories.length;i++){
    if (normalize(db.categories[i][0]).toLowerCase() === n) return i;
  }
  return -1;
}
function refreshDropdown(selectEl){
  const names = categoryNames();
  selectEl.innerHTML = "";
  names.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    selectEl.appendChild(opt);
  });
}
function refreshEditItemChoice(){
  ensureDb();
  const catName = normalize(ui.editCatChoice.value);
  const idx = getCategoryIndexByName(catName);
  ui.editItemChoice.innerHTML = "";
  if (idx < 0) return;
  db.categories[idx].slice(1).forEach(it => {
    const opt = document.createElement("option");
    opt.value = it; opt.textContent = it;
    ui.editItemChoice.appendChild(opt);
  });
}
function refreshAllDropdowns(){
  refreshDropdown(ui.ListOptions);
  refreshDropdown(ui.categories_item);
  refreshDropdown(ui.CatChoice);
  refreshDropdown(ui.editCatChoice);
  refreshEditItemChoice();
}
function renderCategoriesTable(){
  ensureDb();
  ui.categoriesTableBody.innerHTML = "";
  for (const row of db.categories){
    const tr = document.createElement("tr");
    const tdCat = document.createElement("td");
    tdCat.textContent = row[0];
    const tdItems = document.createElement("td");
    tdItems.textContent = row.slice(1).join("\n");
    tr.appendChild(tdCat);
    tr.appendChild(tdItems);
    ui.categoriesTableBody.appendChild(tr);
  }
}
function updateNoListLabel(){
  ensureDb();
  setLabel("NoList", db.categories.length ? "" : "No categories yet.");
}
function showSelectedCategoryItems(selectEl, outputId){
  ensureDb();
  const name = normalize(selectEl.value);
  const idx = getCategoryIndexByName(name);
  if (idx < 0) { setText(outputId, ""); return; }
  setText(outputId, db.categories[idx].slice(1).join("\n"));
}

// ----- Actions -----
function addCategory(){
  ensureDb();
  const name = normalize(getText("category"));
  setText("category", "");
  if (!name){ ui.AddListOutput.value = "Type a category name."; return; }
  if (getCategoryIndexByName(name) !== -1){ ui.AddListOutput.value = "Category already exists."; return; }
  db.categories.push([name]);
  bumpVersion();
  ui.AddListOutput.value = `Added category: ${name}`;
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
}

function deleteSelectedCategory(){
  ensureDb();
  const name = normalize(ui.ListOptions.value);
  if (!name){ ui.AddListOutput.value = "No category selected."; return; }
  const idx = getCategoryIndexByName(name);
  if (idx < 0){ ui.AddListOutput.value = "Category not found."; return; }
  if (!confirm(`Delete category "${name}" and all its items?`)) return;
  db.categories.splice(idx,1);
  bumpVersion();
  ui.AddListOutput.value = `Deleted category: ${name}`;
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
}

function addItem(){
  ensureDb();
  const cat = normalize(ui.categories_item.value);
  const idx = getCategoryIndexByName(cat);
  const item = normalize(getText("itemtoadd"));
  setText("itemtoadd", "");
  if (idx < 0){ setLabel("NoList", "Select a category first."); return; }
  if (!item){ setLabel("NoList", "Type an item."); return; }
  db.categories[idx].push(item);
  bumpVersion();
  setLabel("NoList", `Added "${item}" to ${cat}.`);
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  renderCategoriesTable();
  setGlobalStatus();
}

function removeItem(){
  ensureDb();
  const cat = normalize(ui.categories_item.value);
  const idx = getCategoryIndexByName(cat);
  const item = normalize(getText("itemtoadd"));
  setText("itemtoadd", "");
  if (idx < 0){ setLabel("NoList", "Select a category first."); return; }
  if (!item){ setLabel("NoList", "Type an item to remove."); return; }
  const row = db.categories[idx];
  let removed = false;
  for (let i=1;i<row.length;i++){
    if (normalize(row[i]).toLowerCase() === item.toLowerCase()){
      row.splice(i,1); removed = true; break;
    }
  }
  if (!removed){ setLabel("NoList", `Item not found: "${item}"`); return; }
  bumpVersion();
  setLabel("NoList", `Removed "${item}" from ${cat}.`);
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  renderCategoriesTable();
  setGlobalStatus();
}

function deleteAllItems(){
  ensureDb();
  const cat = normalize(ui.categories_item.value);
  const idx = getCategoryIndexByName(cat);
  if (idx < 0){ setLabel("NoList", "Select a category first."); return; }
  if (!confirm(`Delete ALL items in "${cat}" (keep category)?`)) return;
  db.categories[idx] = [db.categories[idx][0]];
  bumpVersion();
  setLabel("NoList", `Cleared items in ${cat}.`);
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  renderCategoriesTable();
  setGlobalStatus();
}

function applyItemEdit(){
  ensureDb();
  const cat = normalize(ui.editCatChoice.value);
  const idx = getCategoryIndexByName(cat);
  const oldItem = normalize(ui.editItemChoice.value);
  const newItem = normalize(getText("editNewItemInput"));
  setText("editNewItemInput", "");
  if (idx < 0){ ui.editStatus.value = "Select a category."; return; }
  if (!oldItem){ ui.editStatus.value = "Select an item."; return; }
  if (!newItem){ ui.editStatus.value = "Type a new item value."; return; }
  const row = db.categories[idx];
  let changed = false;
  for (let i=1;i<row.length;i++){
    if (row[i] === oldItem){ row[i] = newItem; changed = true; break; }
  }
  if (!changed){ ui.editStatus.value = "Item not found."; return; }
  bumpVersion();
  ui.editStatus.value = `Replaced "${oldItem}" with "${newItem}" in ${cat}.`;
  refreshEditItemChoice();
  renderCategoriesTable();
  setGlobalStatus();
}

function buildFullReport(){
  ensureDb();
  let out = "";
  for (const row of db.categories){
    out += `[${row[0]}]\n`;
    out += row.slice(1).join("\n") + "\n";
    out += "=============\n";
  }
  setText("text_area1", out.trim());
}

// ----- File I/O -----
function importJsonFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const candidate = JSON.parse(String(reader.result || ""));
      const err = validateDb(candidate);
      if (err){ alert(err); return; }
      db = candidate;
      if (!db.schema) db.schema = 1;
      if (!db.version) db.version = 1;
      if (!db.updatedAt) db.updatedAt = nowISO();
      loadedFileName = file.name;
      ui.AddListOutput.value = `Imported: ${file.name}`;
      refreshAllDropdowns();
      renderCategoriesTable();
      setGlobalStatus();
      updateNoListLabel();
      setScreen("Categories");
    }catch(e){
      alert("Could not parse JSON: " + e.message);
    }
  };
  reader.readAsText(file);
}

function exportJson(){
  ensureDb();
  const base = (loadedFileName || MASTER_FILE_DEFAULT).replace(/[^a-zA-Z0-9._-]/g, "_");
  const stem = base.replace(/\.json$/i, "");
  const fileName = `${stem}_v${String(db.version).padStart(4,"0")}.json`;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ----- Wire buttons to your IDs -----
onEvent("btnImport","click", () => el("fileInput").click());
el("fileInput").addEventListener("change", () => {
  const file = el("fileInput").files && el("fileInput").files[0];
  el("fileInput").value = "";
  if (file) importJsonFile(file);
});

onEvent("btnExport","click", exportJson);
onEvent("btnNew","click", () => {
  db = { schema: 1, version: 1, updatedAt: nowISO(), categories: [] };
  loadedFileName = null;
  ui.AddListOutput.value = "New empty database.";
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
  setScreen("Categories");
});

onEvent("AddCategory_btn","click", addCategory);
onEvent("GoList","click", () => { renderCategoriesTable(); ui.AddListOutput.value = "List refreshed."; });
onEvent("deleteCat_btn","click", deleteSelectedCategory);

onEvent("GoAddItem_btn","click", () => {
  ensureDb();
  refreshAllDropdowns();
  updateNoListLabel();
  showSelectedCategoryItems(ui.categories_item, "text_area2");
  setScreen("addItemstoCategories");
});
onEvent("ReturnAddCategories","click", () => setScreen("Categories"));
onEvent("seeList_btn","click", () => showSelectedCategoryItems(ui.categories_item, "text_area2"));
onEvent("addItem_btn","click", addItem);
onEvent("removeItem_btn","click", removeItem);
onEvent("delete_all_items","click", deleteAllItems);

onEvent("report_btn","click", () => {
  ensureDb();
  refreshAllDropdowns();
  showSelectedCategoryItems(ui.CatChoice, "cat_report");
  setScreen("Categoryreport");
});
onEvent("go-to-Categories","click", () => setScreen("Categories"));
ui.CatChoice.addEventListener("change", () => showSelectedCategoryItems(ui.CatChoice, "cat_report"));

onEvent("EditItem_btn","click", () => {
  ensureDb();
  refreshAllDropdowns();
  refreshEditItemChoice();
  ui.editStatus.value = "";
  setScreen("edit_Item");
});
ui.editCatChoice.addEventListener("change", () => refreshEditItemChoice());
onEvent("applyEdit_btn","click", applyItemEdit);
onEvent("editBack_btn","click", () => setScreen("Categories"));

onEvent("returnToitem_btn","click", () => setScreen("addItemstoCategories"));
onEvent("returnTo_Category","click", () => setScreen("Categories"));

// Extra: GoList in Code.org sometimes went to a Report screen; you have a Report screen too.
// If you want a dedicated button later, wire it to: buildFullReport(); setScreen("Report");

// Init
(function init(){
  db = { schema: 1, version: 1, updatedAt: nowISO(), categories: [] };
  loadedFileName = null;
  refreshAllDropdowns();
  renderCategoriesTable();
  setGlobalStatus();
  updateNoListLabel();
  ui.AddListOutput.value = "Ready. Import JSON to load your data.";
})();
