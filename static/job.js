const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("job-form");
const addBtn = document.getElementById("add-btn");
const cancelBtn = document.getElementById("cancel-btn");
const searchInput = document.getElementById("search");
const stageFilter = document.getElementById("stage-filter");

const STAGES = {
  wishlist: "Wishlist",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

let jobs = [];
let editingId = null;

// ---------- Talking to the server ----------
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (res.status === 401) {
      window.location.href = "/login"; // session expired, go log in again
      return null;
    }
    if (!res.ok) throw new Error("Server error " + res.status);
    return await res.json();
  } catch (err) {
    alert("Something went wrong: " + err.message);
    return null;
  }
}

async function loadJobs() {
  const data = await api("/api/jobs");
  if (data) {
    jobs = data;
    render();
  }
}

// ---------- Modal ----------
function openModal(job) {
  if (job) {
    editingId = job.id;
    modalTitle.textContent = "Edit Application";
    document.getElementById("company").value = job.company;
    document.getElementById("role").value = job.role;
    document.getElementById("link").value = job.link;
    document.getElementById("date").value = job.date;
    document.getElementById("status").value = job.status;
    document.getElementById("notes").value = job.notes;
  } else {
    editingId = null;
    modalTitle.textContent = "Add Application";
    form.reset();
  }
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
  form.reset();
}

addBtn.addEventListener("click", () => openModal(null));
cancelBtn.addEventListener("click", closeModal);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    company: document.getElementById("company").value.trim(),
    role: document.getElementById("role").value.trim(),
    link: document.getElementById("link").value.trim(),
    date: document.getElementById("date").value,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value.trim(),
  };

  if (editingId) {
    await api("/api/jobs/" + editingId, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  } else {
    await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  closeModal();
  loadJobs();
});

// ---------- Actions ----------
async function deleteJob(id) {
  await api("/api/jobs/" + id, { method: "DELETE" });
  loadJobs();
}

async function moveJob(id, newStatus) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  await api("/api/jobs/" + id, {
    method: "PUT",
    body: JSON.stringify({ ...job, status: newStatus }),
  });
  loadJobs();
}

// ---------- Drag and drop ----------
document.querySelectorAll(".column").forEach((column) => {
  column.addEventListener("dragover", (e) => {
    e.preventDefault();
    column.classList.add("drag-over");
  });

  column.addEventListener("dragleave", () => {
    column.classList.remove("drag-over");
  });

  column.addEventListener("drop", (e) => {
    e.preventDefault();
    column.classList.remove("drag-over");
    const id = Number(e.dataTransfer.getData("text/plain"));
    moveJob(id, column.id);
  });
});

// ---------- Filters ----------
searchInput.addEventListener("input", render);
stageFilter.addEventListener("change", render);

// ---------- Render ----------
function createCard(job) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.status = job.status;
  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", job.id);
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  const title = document.createElement("h3");
  title.textContent = job.company;

  const role = document.createElement("p");
  role.textContent = job.role;

  card.append(title, role);

  if (job.date) {
    const date = document.createElement("p");
    date.textContent = job.date;
    card.append(date);
  }

  if (job.link && job.link.startsWith("http")) {
    const link = document.createElement("a");
    link.href = job.link;
    link.textContent = "View job post";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
  }

  if (job.notes) {
    const notes = document.createElement("p");
    notes.className = "notes";
    notes.textContent = job.notes;
    card.append(notes);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "edit-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => openModal(job));

  const delBtn = document.createElement("button");
  delBtn.className = "delete-btn";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => deleteJob(job.id));

  const moveSelect = document.createElement("select");
  moveSelect.className = "move-select";
  const placeholder = document.createElement("option");
  placeholder.textContent = "Move to...";
  placeholder.value = "";
  moveSelect.append(placeholder);
  for (const key in STAGES) {
    if (key !== job.status) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = STAGES[key];
      moveSelect.append(opt);
    }
  }
  moveSelect.addEventListener("change", () => {
    if (moveSelect.value) moveJob(job.id, moveSelect.value);
  });

  actions.append(editBtn, delBtn, moveSelect);
  card.append(actions);

  return card;
}

function render() {
  const search = searchInput.value.trim().toLowerCase();
  const stage = stageFilter.value;

  document.querySelectorAll(".cards").forEach((box) => {
    box.innerHTML = "";
  });

  const visibleJobs = jobs.filter((job) => {
    const text = (job.company + " " + job.role).toLowerCase();
    return text.includes(search);
  });

  visibleJobs.forEach((job) => {
    document.querySelector("#" + job.status + " .cards").append(createCard(job));
  });

  document.querySelectorAll(".column").forEach((column) => {
    const count = visibleJobs.filter((j) => j.status === column.id).length;
    column.querySelector("h2").textContent = STAGES[column.id] + " (" + count + ")";
    column.classList.toggle("hidden", stage !== "all" && stage !== column.id);
  });
}

loadJobs();