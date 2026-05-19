"use client";

export default function Error({ error, reset }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center max-w-md p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-2xl font-bold">!</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">ເກີດຂໍ້ຜິດພາດ</h2>
        <p className="text-slate-500 text-sm mb-6">
          {error?.message || "ມີບັນຫາໃນການໂຫຼດໜ້ານີ້"}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
        >
          ລອງໃໝ່
        </button>
      </div>
    </div>
  );
}
