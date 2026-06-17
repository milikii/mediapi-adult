const assert = require("node:assert/strict");
const test = require("node:test");

const { CleanupService } = require("../dist/services/cleanup.js");

function makeFakeDownloader() {
  let removeTaskArgs = null;
  let rejectError = null;

  const fake = {
    addMagnet: () => Promise.reject(new Error("not implemented")),
    getTask: () => Promise.reject(new Error("not implemented")),
    listTasks: () => Promise.reject(new Error("not implemented")),
    removeTask: (id, deleteFiles) => {
      removeTaskArgs = [id, deleteFiles];
      if (rejectError) {
        return Promise.reject(rejectError);
      }
      return Promise.resolve();
    },
  };

  return { fake, getRemoveTaskArgs: () => removeTaskArgs, setRejectError: (e) => { rejectError = e; } };
}

test("CleanupService.cleanup calls removeTask with correct args and returns CleanupRecord on success", async () => {
  const { fake, getRemoveTaskArgs } = makeFakeDownloader();
  const service = new CleanupService(fake);

  const result = await service.cleanup({
    taskId: "t1",
    downloaderId: "h1",
    deleteFiles: true,
    cleanedAt: 123,
  });

  assert.deepEqual(getRemoveTaskArgs(), ["h1", true]);
  assert.deepEqual(result, {
    task_id: "t1",
    downloader_id: "h1",
    deleted_files: true,
    cleaned_at: 123,
  });
  assert.equal(Object.hasOwn(result, "error_summary"), false);
});

test("CleanupService.cleanup returns error_summary on failure", async () => {
  const { fake, setRejectError } = makeFakeDownloader();
  const service = new CleanupService(fake);
  setRejectError(new Error("boom"));

  const result = await service.cleanup({
    taskId: "t1",
    downloaderId: "h1",
    deleteFiles: true,
    cleanedAt: 123,
  });

  assert.deepEqual(result, {
    task_id: "t1",
    downloader_id: "h1",
    deleted_files: false,
    cleaned_at: 123,
    error_summary: "boom",
  });
});
