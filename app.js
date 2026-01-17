// =====================================================
// MasterList (Categories + Items) - IndexedDB Edition
// Adds: Import/Export JSON backups + Persistent storage via IndexedDB
//
// Data model:
//   MasterList = [ ["Category", "Item1", "Item2"], ... ]
//   Category name is always at index [i][0]
// =====================================================

// ----------------------------
// STORAGE CONFIG
// ----------------------------
// Primary persistent storage (per-device, per-browser origin)
const IDB_NAME = "MasterListDB";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

// Keys inside the IDB_STORE
const STORAGE_KEY = "MasterListDB_payload_v1";
const EXPORT_VERSION_KEY = "MasterListDB_export_counter_v1";

// Export reminder state (per-device)
const LAST_EXPORT_AT_KEY = "MasterListDB_last_export_at_v1"; // ISO timestamp
const DIRTY_SINCE_EXPORT_KEY = "MasterListDB_dirty_since_export_v1"; // "1" or "0"
const EXPORT_INDICATOR_ID = "exportIndicator";

let MasterList = [];
let option = [];
let CategoryIndex = {}; // category name -> MasterList index

function $(id) { return document.getElementById(id); }

function setScreen(screenId) {
  const screens = ["Categories", "addItemstoCategories", "RemoveItems", "Categoryreport", "Report", "edit_Item"];
  screens.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hidden", id !== screenId);
  });
}

function setText(id, value) {
  const el = $(id);
  if (!el) return;
  if ("value" in el) el.value = value;
  else el.textContent = value;
}

// Writes a user-facing status message to the first available status element.
// This is defensive: your HTML may use different IDs across screens.
function setStatus(msg) {
  const ids = [
    "AddListOutput",
    "storageNotice",
    "StorageNotice",
    "status",
    "Status",
    "NoList"
  ];

  for (let i = 0; i < ids.length; i++) {
    if ($(ids[i])) {
      setText(ids[i], msg);
      return;
    }
  }
  // Last resort
  console.log(msg);
}

function setTextFirst(ids, msg) {
  for (let i = 0; i < ids.length; i++) {
    if ($(ids[i])) {
      setText(ids[i], msg);
      return true;
    }
  }
  return false;
}

function getText(id) {
  const el = $(id);
  if (!el) return "";
  if ("value" in el) return el.value;
  return el.textContent || "";
}

function setProperty(id, prop, value) {
  const el = $(id);
  if (!el) return;

  if (prop === "options" && el.tagName === "SELECT") {
    el.innerHTML = "";
    (value || []).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
    return;
  }

  if (prop === "index" && el.tagName === "SELECT") {
    el.selectedIndex = Math.max(0, value ?? 0);
    return;
  }

  el[prop] = value;
}

function getProperty(id, prop) {
  const el = $(id);
  if (!el) return null;

  if (prop === "options" && el.tagName === "SELECT") {
    return Array.from(el.options).map(o => o.value);
  }

  if (prop === "index" && el.tagName === "SELECT") {
    return el.selectedIndex;
  }

  return el[prop];
}

function showElement(id) { const el = $(id); if (el) el.style.display = ""; }
function hideElement(id) { const el = $(id); if (el) el.style.display = "none"; }

function normalize(s) {
  if (s === undefined || s === null) return "";
  return ("" + s).trim();
}

function showNoList(msg) { setText("NoList", msg); showElement("NoList"); }
function hideNoList() { setText("NoList", ""); hideElement("NoList"); }

// ----------------------------
// INDEXING
// ----------------------------
function rebuildCategoryIndex() {
  CategoryIndex = {};
  for (let i = 0; i < MasterList.length; i++) {
    CategoryIndex[MasterList[i][0]] = i;
  }
}

function findCategoryIndex(name) {
  name = normalize(name);
  if (name === "") return -1;
  const idx = CategoryIndex[name];
  return (idx === undefined) ? -1 : idx;
}

// ----------------------------
// OPTIONS / DROPDOWNS
// ----------------------------
function rebuildOptionsFromMasterList() {
  option = [];
  for (let i = 0; i < MasterList.length; i++) option.push(MasterList[i][0]);
}

function syncCategoryOptions() {
  rebuildOptionsFromMasterList();
  setProperty("ListOptions", "options", option);
  setProperty("categories_item", "options", option);
  setProperty("removeCatChoice", "options", option);
  setProperty("editCatChoice", "options", option);
  setProperty("CatChoice", "options", option);
}

function ensureValidCategorySelection(dropdownId) {
  if (option.length === 0) return false;
  const idx = getProperty(dropdownId, "index");
  if (idx === undefined || idx === null || idx < 0) setProperty(dropdownId, "index", 0);
  return true;
}

// ----------------------------
// RENDERING
// ----------------------------
function itemsToBulletText(arr) {
  if (!arr || arr.length <= 1) return "No items yet.";
  let out = "";
  for (let i = 1; i < arr.length; i++) out += "- " + arr[i] + "\n";
  return out;
}

function showDataDiagnostics(context) {
  const msg = "Data loaded (" + (context || "") + "): " + MasterList.length + " categories." + (MasterList.length ? " First: " + MasterList[0][0] : "");
  // Prefer AddListOutput if present; otherwise fall back to console.
  if ($("AddListOutput")) setText("AddListOutput", msg);
  else console.log(msg);
}

function display() {
  let text = "";
  for (let i = 0; i < MasterList.length; i++) {
    text += "[" + MasterList[i][0] + "]\n";
    text += itemsToBulletText(MasterList[i]) + "\n";
    text += "=============\n";
  }
  // Write to whichever output area exists in your HTML.
  if (!setTextFirst(["text_area1", "text_area2", "cat_report"], text)) {
    console.log(text);
  }
}

function showItemsForSelectedCategory() {
  const selectedCategory = getText("categories_item");

  if (option.length === 0) {
    setText("text_area2", "");
    showNoList("No categories yet. Add a category first.");
    return;
  }

  if (!selectedCategory) {
    setText("text_area2", "");
    showNoList("Choose a category.");
    return;
  }

  const idx = findCategoryIndex(selectedCategory);
  if (idx === -1) {
    setText("text_area2", "");
    showNoList("Category not found.");
    return;
  }

  setText("text_area2", itemsToBulletText(MasterList[idx]));
}

function showCatReport() {
  const selectedCategory = getText("CatChoice");
  if (!selectedCategory) { setText("cat_report", ""); return; }

  const idx = findCategoryIndex(selectedCategory);
  if (idx === -1) { setText("cat_report", "Not found."); return; }

  setText("cat_report", itemsToBulletText(MasterList[idx]));
}

// ----------------------------
// SCREEN REFRESHERS
// ----------------------------
function refreshCategoriesUI() {
  if (option.length > 0) {
    setProperty("ListOptions", "index", 0);
    // do not overwrite status if it has an import/export message
  } else {
    setStatus("No categories yet.");
  }
}

function refreshAddItemsUI() {
  if (!ensureValidCategorySelection("categories_item")) {
    showNoList("No categories yet. Add a category first.");
    setText("text_area2", "");
    return;
  }
  hideNoList();
  showItemsForSelectedCategory();
}

function fillRemoveItemsDropdown() {
  const categoryName = getText("removeCatChoice");

  if (!categoryName) {
    setProperty("removeItemChoice", "options", []);
    setText("removePreview", "");
    setText("removeStatus", "Choose a category.");
    return;
  }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) {
    setProperty("removeItemChoice", "options", []);
    setText("removePreview", "");
    setText("removeStatus", "Category not found.");
    return;
  }

  const items = [];
  for (let i = 1; i < MasterList[idx].length; i++) items.push(MasterList[idx][i]);

  // Keep UX consistent: show a placeholder option when empty.
  setProperty("removeItemChoice", "options", items.length ? items : ["No items"]);
  setProperty("removeItemChoice", "index", 0);

  setText("removePreview", itemsToBulletText(MasterList[idx]));
  setText("removeStatus", items.length ? "" : "No items to delete in this category.");
}

function refreshRemoveItemsUI() {
  if (!ensureValidCategorySelection("removeCatChoice")) {
    setProperty("removeItemChoice", "options", []);
    setText("removePreview", "");
    setText("removeStatus", "No categories yet. Add a category first.");
    return;
  }
  fillRemoveItemsDropdown();
}

function fillEditItemsDropdown() {
  const categoryName = getText("editCatChoice");

  if (!categoryName) {
    setProperty("editItemChoice", "options", []);
    setText("editStatus", "Choose a category.");
    return;
  }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) {
    setProperty("editItemChoice", "options", []);
    setText("editStatus", "Category not found.");
    return;
  }

  let items = [];
  for (let i = 1; i < MasterList[idx].length; i++) items.push(MasterList[idx][i]);
  if (items.length === 0) items = ["No items"];

  setProperty("editItemChoice", "options", items);
  setProperty("editItemChoice", "index", 0);

  const first = getText("editItemChoice");
  setText("editNewItemInput", (first !== "No items") ? first : "");
}

function selectDropdownValueIfPresent(dropdownId, value) {
  const el = $(dropdownId);
  if (!el || el.tagName !== "SELECT") return;
  const idx = Array.from(el.options).findIndex(o => o.value === value);
  if (idx >= 0) el.selectedIndex = idx;
}

function refreshEditScreenUI() {
  if (!ensureValidCategorySelection("editCatChoice")) {
    setProperty("editItemChoice", "options", []);
  } else {
    fillEditItemsDropdown();
  }
  setText("editNewItemInput", "");
  setText("editStatus", "");
}

function refreshCategoryReportUI() {
  if (!ensureValidCategorySelection("CatChoice")) {
    setText("cat_report", "");
    return;
  }
  showCatReport();
}

// ----------------------------
// INDEXEDDB PERSISTENCE (primary)
// ----------------------------
function makePayload() {
  return {
    schema: 1,
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: MasterList
  };
}

let __idbPromise = null;

function openIdb() {
  if (__idbPromise) return __idbPromise;

  __idbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = function (e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    req.onsuccess = function (e) {
      resolve(e.target.result);
    };

    req.onerror = function () {
      reject(req.error || new Error("Failed to open IndexedDB"));
    };
  });

  return __idbPromise;
}

async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
  });
}

async function idbSet(key, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("IndexedDB put failed"));
  });
}

async function idbDelete(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("IndexedDB delete failed"));
  });
}

// ----------------------------
// EXPORT REMINDER UI
// ----------------------------
function ensureExportIndicator() {
  // Creates a small status span next to the Export button if your HTML
  // does not already include one.
  if ($(EXPORT_INDICATOR_ID)) return;

  const exportBtn = $("export_btn");
  if (!exportBtn || !exportBtn.parentNode) return;

  const span = document.createElement("span");
  span.id = EXPORT_INDICATOR_ID;
  span.style.marginLeft = "10px";
  span.style.fontSize = "12px";
  span.style.opacity = "0.85";
  exportBtn.parentNode.insertBefore(span, exportBtn.nextSibling);
}

function formatLocalDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch (e) {
    return "";
  }
}

function markDirtySinceExport() {
  localStorage.setItem(DIRTY_SINCE_EXPORT_KEY, "1");
  updateExportIndicator();
}

function markCleanAfterExport() {
  localStorage.setItem(DIRTY_SINCE_EXPORT_KEY, "0");
  localStorage.setItem(LAST_EXPORT_AT_KEY, new Date().toISOString());
  updateExportIndicator();
}

function updateExportIndicator() {
  const el = $(EXPORT_INDICATOR_ID);
  if (!el) return;

  const last = localStorage.getItem(LAST_EXPORT_AT_KEY) || "";
  const dirty = (localStorage.getItem(DIRTY_SINCE_EXPORT_KEY) || "0") === "1";

  if (!last && dirty) {
    el.textContent = "Export recommended (no prior export).";
    return;
  }

  if (!last && !dirty) {
    el.textContent = "Last export: (none yet).";
    return;
  }

  const when = formatLocalDateTime(last) || last;
  el.textContent = dirty
    ? ("Last export: " + when + " — export recommended.")
    : ("Last export: " + when + ".");
}

function saveToStorage() {
  // Fire-and-forget write to IndexedDB. (We keep this non-async so callers
  // don't have to be rewritten; errors are surfaced via AddListOutput.)
  idbSet(STORAGE_KEY, makePayload()).catch(() => {
    setStatus("Save failed: browser storage unavailable.");
  });

  // Any change to persisted data means the current state differs from the last export.
  markDirtySinceExport();
}

async function loadFromStorage() {
  let obj = null;
  try {
    obj = await idbGet(STORAGE_KEY);
  } catch (e) {
    obj = null;
  }

  if (!obj) {
    MasterList = [];
    rebuildCategoryIndex();
    syncCategoryOptions();
    return;
  }

  const cats = Array.isArray(obj) ? obj : (obj.categories || []);
  MasterList = Array.isArray(cats) ? cats : [];

  rebuildCategoryIndex();
  syncCategoryOptions();
  // Helpful in environments where dropdowns may not be visible/available.
  if (MasterList.length > 0) showDataDiagnostics("startup");
}

// ----------------------------
// IMPORT / EXPORT
// ----------------------------
function validateCategoriesShape(cats) {
  if (!Array.isArray(cats)) return { ok: false, message: "JSON is missing a categories array." };

  for (let i = 0; i < cats.length; i++) {
    const row = cats[i];
    if (!Array.isArray(row) || row.length < 1) {
      return { ok: false, message: "Category entry #" + (i + 1) + " is not a valid array." };
    }
    const name = normalize(row[0]);
    if (name === "") {
      return { ok: false, message: "Category entry #" + (i + 1) + " has an empty name at [0]." };
    }
  }
  return { ok: true, message: "OK" };
}

function setAllFromImported(categories) {
  // Normalize category names and items; preserve ordering
  MasterList = categories.map(arr => arr.map(v => normalize(v)));
  rebuildCategoryIndex();
  syncCategoryOptions();
  saveToStorage();

  // Force the UI to a known-good state so the user immediately sees the imported data.
  // If your HTML does not implement screen containers, this is a no-op.
  setScreen("Categories");
  if (!$("Categories") && $("Report")) setScreen("Report");

  // Select the first category everywhere, if present.
  refreshCategoriesUI();
  if (option.length > 0) {
    setProperty("ListOptions", "index", 0);
    setProperty("categories_item", "index", 0);
    setProperty("removeCatChoice", "index", 0);
    setProperty("CatChoice", "index", 0);
    setProperty("editCatChoice", "index", 0);
  }

  // Refresh all screens in case user navigates immediately.
  refreshAddItemsUI();
  refreshRemoveItemsUI();
  refreshEditScreenUI();
  refreshCategoryReportUI();
  // Always print a full text summary somewhere so the user can confirm import succeeded.
  display();
}


// ----------------------------
// IMPORT FILE PICKER (web/iOS friendly)
// ----------------------------
// Many mobile browsers (including iOS Safari) will not allow a script to
// read a file unless the user explicitly selects it via a file picker.
// This helper ensures we have a hidden <input type="file"> and wires it
// so clicking the Import button can open the picker and then run the import.
function ensureImportFileInput() {
  // Your index.html already includes <input id="importFile">.
  // In that case, we must still bind the change handler.
  const existing = $("importFile");
  if (existing) {
    if (!existing.__mlImportBound) {
      existing.addEventListener("change", function () {
        importFromSelectedFile();
      });
      existing.__mlImportBound = true;
    }
    return;
  }

  // Fallback: if no file input exists in the HTML, create a hidden one.
  const input = document.createElement("input");
  input.type = "file";
  input.id = "importFile";
  input.accept = ".json,application/json";
  input.style.display = "none";

  input.addEventListener("change", function () {
    importFromSelectedFile();
  });

  document.body.appendChild(input);
}

async function importFromSelectedFile() {
  const input = $("importFile");
  const file = input?.files?.[0];
  if (!file) {
    setStatus("Select MasterListDB.json first.");
    return;
  }

  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    // Accept both legacy formats (array) and wrapped payloads (object).
    // Primary: { categories: [...] }
    // Back-compat: { MasterList: [...] } or { data: [...] }
    const cats = Array.isArray(obj)
      ? obj
      : (obj.categories || obj.MasterList || obj.data || []);
    const v = validateCategoriesShape(cats);
    if (!v.ok) {
      setStatus("Import failed: " + v.message);
      return;
    }

    setAllFromImported(cats);
    // Show a concise confirmation and keep the imported data visible on-screen.
    setStatus(
      "Imported " + cats.length + " categories from " + file.name + ". Now showing " + (option.length || 0) + " categories."
    );
  } catch (e) {
    setStatus("Import failed: invalid JSON file.");
  } finally {
    // allow re-importing same file without reselecting in some browsers
    if (input) input.value = "";
  }
}

function exportToJsonFile() {
  // Browser-safe export: triggers a normal download so the browser can present a Save dialog.
  // Note: Whether you see a “Save As…” prompt depends on your browser settings.
  const payload = makePayload();
  const jsonText = JSON.stringify(payload, null, 2);

  // Versioned filename: timestamp + monotonic export counter
  const nextV = (Number(localStorage.getItem(EXPORT_VERSION_KEY) || 0) + 1);
  localStorage.setItem(EXPORT_VERSION_KEY, String(nextV));

  const d = new Date();
  const stamp =
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0") + "_" +
    String(d.getHours()).padStart(2, "0") + "-" +
    String(d.getMinutes()).padStart(2, "0");

  const filename = "MasterListDB_" + stamp + "_v" + nextV + ".json";

  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Give the browser a moment to start the download before revoking (Safari is happier with this).
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);

  markCleanAfterExport();
  setText("AddListOutput", "Export started: " + filename + " (" + MasterList.length + " categories)." );
}


// ----------------------------
// OPERATIONS
// ----------------------------
function addCategory(categoryName) {
  categoryName = normalize(categoryName);
  if (categoryName === "") {
    setText("AddListOutput", "Type a category name.");
    return;
  }
  if (findCategoryIndex(categoryName) !== -1) {
    setText("AddListOutput", "Category already exists: " + categoryName);
    return;
  }

  MasterList.push([categoryName]);
  CategoryIndex[categoryName] = MasterList.length - 1;

  syncCategoryOptions();
  saveToStorage();

  setText("category", "");
  refreshCategoriesUI();
  setText("AddListOutput", "Added: " + categoryName);
}

function deleteSelectedCategory() {
  const catIndex = getProperty("ListOptions", "index");
  if (catIndex === undefined || catIndex === null || catIndex < 0) {
    setText("AddListOutput", "Choose a category to delete.");
    return;
  }
  if (catIndex >= MasterList.length) return;

  const name = MasterList[catIndex][0];

  // Delete all entries matching the name (keeps compatibility with old duplicates)
  MasterList = MasterList.filter(arr => arr[0] !== name);

  rebuildCategoryIndex();
  syncCategoryOptions();
  saveToStorage();

  refreshCategoriesUI();
  setText("AddListOutput", "Deleted: " + name);
}

function addItemToSelectedCategory() {
  const categoryName = normalize(getText("categories_item"));
  const newItem = normalize(getText("itemtoadd"));

  if (newItem === "") {
    showNoList("Type an item to add.");
    return;
  }

  setText("itemtoadd", "");
  hideNoList();

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) { showNoList("Category not found."); return; }

  MasterList[idx].push(newItem);
  saveToStorage();

  showItemsForSelectedCategory();
  showNoList("Added: " + newItem);
}

function removeItemFromSelectedCategory() {
  const categoryName = normalize(getText("categories_item"));
  const itemName = normalize(getText("itemtoadd"));

  if (itemName === "") { showNoList("Type an item to remove."); return; }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) { showNoList("Category not found."); return; }

  const target = normalize(itemName);
  const oldArray = MasterList[idx];

  const newArray = [oldArray[0]];
  let removedCount = 0;

  for (let i = 1; i < oldArray.length; i++) {
    if (normalize(oldArray[i]) === target) removedCount++;
    else newArray.push(oldArray[i]);
  }

  setText("itemtoadd", "");

  if (removedCount === 0) { showNoList("Item not found: " + itemName); return; }

  MasterList[idx] = newArray;
  saveToStorage();

  showItemsForSelectedCategory();
  showNoList("Removed " + removedCount + " time(s): " + itemName);
}

function removeSelectedItemFromRemoveScreen() {
  const categoryName = normalize(getText("removeCatChoice"));
  const itemName = getText("removeItemChoice");

  if (categoryName === "") {
    setText("removeStatus", "Choose a category.");
    return;
  }

  if (itemName === "" || itemName === "No items") {
    setText("removeStatus", "No item selected to delete.");
    return;
  }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) {
    setText("removeStatus", "Category not found.");
    return;
  }

  const target = normalize(itemName);
  const oldArray = MasterList[idx];

  const newArray = [oldArray[0]];
  let removedCount = 0;

  for (let i = 1; i < oldArray.length; i++) {
    if (normalize(oldArray[i]) === target) removedCount++;
    else newArray.push(oldArray[i]);
  }

  if (removedCount === 0) {
    setText("removeStatus", "Item not found: " + itemName);
    return;
  }

  MasterList[idx] = newArray;
  saveToStorage();

  // Refresh dependent UIs
  showItemsForSelectedCategory();
  refreshEditScreenUI();
  refreshCategoryReportUI();
  fillRemoveItemsDropdown();

  setText("removeStatus", "Deleted " + removedCount + " time(s): " + itemName);
}

function deleteAllItemsKeepCategories() {
  const categoryName = normalize(getText("categories_item"));

  if (option.length === 0) {
    showNoList("No categories yet.");
    return;
  }

  if (!categoryName) {
    showNoList("Choose a category first.");
    return;
  }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) {
    showNoList("Category not found.");
    return;
  }

  // Clear ONLY the selected category's items; keep its name at index 0.
  MasterList[idx] = [MasterList[idx][0]];

  rebuildCategoryIndex();
  saveToStorage();

  syncCategoryOptions();
  showItemsForSelectedCategory();
  refreshEditScreenUI();
  refreshCategoryReportUI();
  showNoList("All items deleted for: " + categoryName);
}

function applyEdit() {
  const categoryName = normalize(getText("editCatChoice"));
  const oldItem = getText("editItemChoice");
  const newItem = normalize(getText("editNewItemInput"));

  if (categoryName === "") { setText("editStatus", "Choose a category."); return; }
  if (oldItem === "" || oldItem === "No items") { setText("editStatus", "Choose an item to edit."); return; }
  if (newItem === "") { setText("editStatus", "Type the new item text."); return; }

  const idx = findCategoryIndex(categoryName);
  if (idx === -1) { setText("editStatus", "Category not found."); return; }

  let pos = -1;
  for (let i = 1; i < MasterList[idx].length; i++) {
    if (MasterList[idx][i] === oldItem) { pos = i; break; }
  }
  if (pos === -1) { setText("editStatus", "Item not found in that category."); return; }

  MasterList[idx][pos] = newItem;
  saveToStorage();

  fillEditItemsDropdown();
  selectDropdownValueIfPresent("editItemChoice", newItem);
  setText("editStatus", "Updated '" + oldItem + "' to '" + newItem + "'.");
}

// ----------------------------
// NAVIGATION
// ----------------------------
function goAddItems() { setScreen("addItemstoCategories"); refreshAddItemsUI(); }
function goRemoveItems() { setScreen("RemoveItems"); refreshRemoveItemsUI(); }
function goCategories() { setScreen("Categories"); refreshCategoriesUI(); }

// ----------------------------
// EVENT WIRING
// ----------------------------
function safeOn(id, event, handler) {
  const el = $(id);
  if (!el) {
    // If an element is missing in the current HTML, skip wiring rather than crashing init.
    return false;
  }
  el.addEventListener(event, handler);
  return true;
}

function onClick(id, fn) {
  const el = $(id);
  if (!el) return;
  el.addEventListener("click", fn);
}

function onChange(id, fn) {
  const el = $(id);
  if (!el) return;
  el.addEventListener("change", fn);
}

function wireEvents() {
  // Categories screen
  safeOn("AddCategory_btn", "click", () => addCategory(getText("category")));
  onClick("deleteCat_btn", deleteSelectedCategory);

  onClick("GoAddItem_btn", goAddItems);

  safeOn("GoList", "click", () => { setScreen("Report"); display(); });
  safeOn("EditItem_btn", "click", () => { setScreen("edit_Item"); refreshEditScreenUI(); });
  safeOn("report_btn", "click", () => { setScreen("Categoryreport"); refreshCategoryReportUI(); });

  // Import / Export
  safeOn("import_btn", "click", function () {
    ensureImportFileInput();
    const input = $("importFile");
    if (!input) {
      setText("AddListOutput", "Import is unavailable: file picker could not be created.");
      return;
    }
    // If a file is already selected (common on desktop), import immediately.
    // Otherwise, open the system file picker (required on iOS).
    if (input.files && input.files[0]) {
      importFromSelectedFile();
    } else {
      input.click();
    }
  });
  onClick("export_btn", exportToJsonFile);

  // Add items screen
  safeOn("categories_item", "change", () => { hideNoList(); showItemsForSelectedCategory(); });
  onClick("additem_btn", addItemToSelectedCategory);
  // Remove Item now navigates to a dedicated screen with dropdown selection
  onClick("removeItem_btn", goRemoveItems);
  safeOn("seeList_btn", "click", () => { setScreen("Report"); display(); });
  onClick("delete_all_items", deleteAllItemsKeepCategories);
  onClick("ReturnAddCategories", goCategories);

  // Remove Items screen
  safeOn("removeCatChoice", "change", () => {
    fillRemoveItemsDropdown();
  });
  onClick("confirmRemove_btn", removeSelectedItemFromRemoveScreen);
  onClick("removeBack_btn", goAddItems);
  onClick("removeReturnCategories", goCategories);

  // Category report screen
  onChange("CatChoice", showCatReport);
  onClick("go-to-Categories", goCategories);
  onClick("returnToitem_btn", goAddItems);

  // Report screen
  onClick("returnTo_Category", goCategories);
  onClick("returnToitem_btn_report", goAddItems);

  // Edit screen
  safeOn("editCatChoice", "change", () => {
    fillEditItemsDropdown();
    setText("editNewItemInput", "");
    setText("editStatus", "");
  });
  safeOn("editItemChoice", "change", () => {
    const oldItem = getText("editItemChoice");
    setText("editNewItemInput", oldItem);
    setText("editStatus", "");
  });
  onClick("applyEdit_btn", applyEdit);
  onClick("editBack_btn", goCategories);
}

// ----------------------------
// AUTO-IMPORT (optional)
// ----------------------------
// Attempts to fetch ./MasterListDB.json from the same directory as index.html.
//
// Safety rules:
//  - If localStorage already has data, it will NOT overwrite unless you launch with ?overwrite=1
//  - If localStorage is empty, it will auto-load if the JSON file is reachable
//
// Notes:
//  - Many browsers block fetch() from file:// URLs. For auto-import to work reliably,
//    run a local web server (examples):
//      - Python:  python3 -m http.server 8000
//      - Node:    npx serve .
//    Then open: http://localhost:8000
async function tryAutoImportFromJsonFile() {
  // Only auto-import if we do not already have a saved payload,
  // unless the user explicitly requests overwrite.
  let hasExisting = false;
  try {
    const existing = await idbGet(STORAGE_KEY);
    hasExisting = !!existing;
  } catch (e) {
    hasExisting = false;
  }
  const params = new URLSearchParams(window.location.search);
  const allowOverwrite = params.get("overwrite") === "1";

  if (hasExisting && !allowOverwrite) return;

  try {
    const res = await fetch("./MasterListDB.json", { cache: "no-store" });
    if (!res.ok) return;

    const obj = await res.json();
    const cats = Array.isArray(obj) ? obj : (obj.categories || []);
    const v = validateCategoriesShape(cats);
    if (!v.ok) return;

    MasterList = cats.map(arr => arr.map(v => normalize(v)));
    rebuildCategoryIndex();
    syncCategoryOptions();
    saveToStorage();

    setText("AddListOutput", "Auto-imported MasterListDB.json (" + cats.length + " categories).");
  } catch (e) {
    // Fail silently; manual import remains available.
    return;
  }
}

// ----------------------------
// STARTUP
// ----------------------------
async function init() {
  hideElement("NoList");
  setProperty("ListOptions", "options", []);

  // Export reminder UI (creates a small status element if missing)
  ensureExportIndicator();
  // Initialize display; defaults to "Last export: (none yet)." until first export
  updateExportIndicator();

  // Attempt auto-import first (may populate localStorage)
  await tryAutoImportFromJsonFile();

  // Then load whatever is in IndexedDB
  await loadFromStorage();
  wireEvents();

  setScreen("Categories");
  refreshCategoriesUI();
}

document.addEventListener("DOMContentLoaded", init);
