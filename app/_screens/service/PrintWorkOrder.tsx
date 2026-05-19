"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer, Loader2, HardHat, User, Calendar, ClipboardList, Package, Wrench, UserCheck, Users } from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


export default function PrintWorkOrder() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/work-orders/${id}`, { headers: _getAuthHeaders() }).then(r => r.json());
        setData({
          ...res,
          helper_lookup: res?.helper_lookup || [],
          logs: res?.logs || [],
          materials: res?.materials || [],
          checkins: res?.checkins || []
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const helpers = Array.isArray(data?.helper_ids)
    ? data.helper_ids
    : (typeof data?.helper_ids === "string" ? data.helper_ids.split(",").map(s => s.trim()).filter(Boolean) : []);

  const helperNames = helpers.map((h) => {
    const match = data?.helper_lookup?.find?.((x) => x.code === h);
    if (match) return match.name_1 || match.name || h;
    return h;
  });
  
  const taskNames = Array.isArray(data?.tasks) && data.tasks.length
    ? data.tasks.map((t) => t.task_name || t.task || t.name).filter(Boolean)
    : (data?.task_name ? [data.task_name] : []);

  const statusLabelMap = {
    draft: "ສະບັບຮ່າງ",
    assigned: "ມອບໝາຍແລ້ວ",
    in_progress: "ກຳລັງດຳເນີນ",
    completed: "ສຳເລັດ",
    closed: "ປິດແລ້ວ",
    material_request: "ຂໍເບີກອຸປະກອນ",
  };

  const formatDate = (dateString) => {
    if (!dateString) return "ບໍ່ມີ";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "ບໍ່ມີ";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "ບໍ່ມີ";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "ບໍ່ມີ";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
  };

  const content = (
    <>
      <style type="text/css" media="print">
        {`
          @page {
            size: A4;
            margin: 1.2cm;
          }
          html, body {
            margin: 0 !important;
            background: #fff !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          aside, nav, header.theme-topbar, .theme-dashboard-shell > header, .no-print {
            display: none !important;
          }
          .print-page-only {
            display: block !important;
          }
        `}
      </style>
      <div className="print-page-only min-h-screen bg-gray-100 print:bg-white">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
          
          <div className="bg-white rounded-lg shadow-[var(--theme-shadow)] print:shadow-none print:rounded-none p-8 sm:p-12 print:p-0">
            
            {/* Header */}
            <div className="flex justify-between items-start pb-6 border-b border-gray-200">
              <div className="flex items-center gap-5">
                <div className="flex items-center justify-center w-24 h-24 bg-white border border-gray-200 rounded-full p-2 print:w-16 print:h-16">
                  <img
                    src="/ODG.png"
                    alt="ODG logo"
                    className="w-20 h-20 object-contain print:w-12 print:h-12"
                  />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 print:text-xl">ODIEN GROUP</h2>
                  <p className="text-sm text-gray-500 mt-1 print:text-[10px]">ບ້ານ ຂົວຫຼວງ ເມືອງ ຈັນທະບູລີ, ນະຄອນຫຼວງ ວຽງຈັນ, ສປປລາວ</p>
                  <p className="text-sm text-gray-500 print:text-[10px]">ໂທ: (021) 260 | Email:  Info@odien.net</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-4xl font-black text-gray-800 tracking-tight print:text-2xl">ໃບງານ</h1>
                <p className="text-lg font-semibold text-gray-500 print:text-sm">ໃບງານຊ່າງ</p>
                <button onClick={() => window.print()} className="mt-4 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2 print:hidden">
                  <Printer size={16}/> ພິມ
                </button>
              </div>
            </div>

            {loading && (
              <div className="text-center py-20">
                <Loader2 className="animate-spin inline-block text-gray-400" size={32}/>
                <p className="text-sm text-gray-500 mt-2">ກຳລັງໂຫຼດໃບງານ...</p>
              </div>
            )}

            {data && (
              <div className="pt-6 print:pt-4">
                {/* WO Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 font-semibold uppercase print:text-[9px]">ເລກທີໃບງານ</p>
                    <p className="text-xl font-bold text-gray-800 font-mono print:text-base">{data.code}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 font-semibold uppercase print:text-[9px]">ວັນທີອອກໃບ</p>
                    <p className="text-lg font-semibold text-gray-800 print:text-sm">{formatDate(data.created_at)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 font-semibold uppercase print:text-[9px]">ສະຖານະ</p>
                    <p className={`text-lg font-bold print:text-sm ${data.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{statusLabelMap[data.status] || "ບໍ່ລະບຸ"}</p>
                  </div>
                </div>

                {/* Project & Task Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-8 print:mb-6">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold border-b border-gray-200 pb-2 mb-2 text-gray-800 print:text-sm">ຂໍ້ມູນໂຄງການ</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-[var(--theme-primary-tint)] text-[var(--theme-primary)] rounded-lg"><HardHat size={16}/></div>
                      <div>
                        <p className="text-[11px] text-gray-500">ໂຄງການ</p>
                        <p className="font-semibold text-gray-800 print:text-xs">{data.project_name || 'ບໍ່ມີ'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-600 rounded-lg"><Wrench size={16}/></div>
                      <div>
                        <p className="text-[11px] text-gray-500">ໜ້າວຽກຫຼັກ</p>
                        <p className="font-semibold text-gray-800 print:text-xs">{taskNames[0] || data.task_name || 'ບໍ່ມີ'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg"><ClipboardList size={16}/></div>
                      <div>
                        <p className="text-[11px] text-gray-500">ເລກສັນຍາ</p>
                        <p className="font-medium text-gray-800 font-mono print:text-xs">{data.contract_no || 'ບໍ່ມີ'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base font-bold border-b border-gray-200 pb-2 mb-2 text-gray-800 print:text-sm">ທີມງານ / ໜ້າທີ່</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg"><UserCheck size={16}/></div>
                      <div>
                        <p className="text-[11px] text-gray-500">ຜູ້ອອກໃບ / ຜູ້ຈັດການ</p>
                        <p className="font-semibold text-gray-800 print:text-xs">{data.creator_name || data.created_by || 'ບໍ່ມີ'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-green-50 text-green-600 rounded-lg"><User size={16}/></div>
                      <div>
                        <p className="text-[11px] text-gray-500">ຊ່າງນໍາ</p>
                        <p className="font-semibold text-gray-800 print:text-xs">{data.technician_name || data.technician_id || 'ບໍ່ມີ'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg mt-1"><Users size={16}/></div>
                      <div>
                        <p className="text-[11px] text-gray-500">ຜູ້ຊ່ວຍ</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {helperNames.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">ບໍ່ມີ</span>
                          ) : helperNames.map((h, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-gray-200 text-[10px] text-gray-800 font-medium">{h}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Task List */}
                <div className="mb-8 print:mb-6">
                  <h3 className="text-base font-bold text-gray-800 mb-2 print:text-sm">ລາຍການໜ້າວຽກ</h3>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="min-w-full text-xs print:text-[10px]">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ລຳດັບ</th>
                          <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ໜ້າວຽກ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {taskNames.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-center text-gray-400 italic">
                              ບໍ່ມີລາຍການ
                            </td>
                          </tr>
                        ) : (
                          taskNames.map((task, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5 text-gray-600 font-mono">{idx + 1}</td>
                              <td className="px-3 py-1.5 text-gray-800">{task}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Task Description */}
                <div className="mb-8 print:mb-6">
                  <h3 className="text-base font-bold text-gray-800 mb-2 print:text-sm">ລາຍລະອຽດວຽກ</h3>
                  <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap print:text-[10px]">{data.description || "ບໍ່ມີລາຍລະອຽດ"}</p>
                  </div>
                </div>

                {/* Materials Used */}
                {data.materials?.length > 0 && (
                  <div className="mb-8 page-break-before print:mb-6">
                    <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2 print:text-sm"><Package size={18}/> ວັດສະດຸ/ອຸປະກອນທີ່ໃຊ້</h3>
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <table className="min-w-full text-xs print:text-[10px]">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ລະຫັດ</th>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ຊື່ລາຍການ</th>
                            <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ຈຳນວນ</th>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ຫົວໜ່ວຍ</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.materials.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5 font-mono text-gray-800">{item.item_code}</td>
                              <td className="px-3 py-1.5 text-gray-700">{item.item_name}</td>
                              <td className="px-3 py-1.5 text-right font-semibold text-gray-800">{item.qty}</td>
                              <td className="px-3 py-1.5 text-gray-500">{item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Check-ins */}
                {data.checkins?.length > 0 && (
                  <div className="mb-8 page-break-before print:mb-6">
                    <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2 print:text-sm"><Calendar size={18}/> ປະຫວັດການເຄື່ອນໄຫວ / ເຊັກອິນ</h3>
                     <div className="border border-gray-200 rounded-md overflow-hidden">
                      <table className="min-w-full text-xs print:text-[10px]">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ເວລາ</th>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ຊ່າງ</th>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ການດຳເນີນ</th>
                            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">ຕຳແໜ່ງ</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.checkins.map((ci, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-1.5 text-gray-600">{formatDateTime(ci.created_at)}</td>
                              <td className="px-3 py-1.5 font-medium text-gray-800">{ci.user}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${ci.check_type === 'check-in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {ci.check_type === "check-in" ? "ເຊັກອິນ" : "ເຊັກອາວ"}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-gray-500 text-[10px]">{ci.lat}, {ci.lng}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-8 mt-8 border-t-2 border-dashed border-gray-200 flex justify-between items-end print:pt-4 print:mt-4">
                  <div className="flex gap-6">
                    <div className="w-40">
                      <div className="border-b border-gray-400 h-12 mb-2"></div>
                      <p className="text-xs text-gray-600 font-semibold print:text-[10px]">ລາຍເຊັນຊ່າງ</p>
                    </div>
                    <div className="w-40">
                      <div className="border-b border-gray-400 h-12 mb-2"></div>
                      <p className="text-xs text-gray-600 font-semibold print:text-[10px]">ລາຍເຊັນລູກຄ້າ</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(window.location.href)}`}
                      alt="QR ໃບງານ"
                      className="w-20 h-20"
                    />
                    <p className="text-xs text-gray-500 mt-1 font-mono print:text-[10px]">{data.code}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="print:hidden">
        {content}
      </div>
      <div className="hidden print:block">
        {content}
      </div>
    </>
  );
}
