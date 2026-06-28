/**
 * Multi-language dictionary (Lao / Thai / English). Lao is the source language
 * and the fallback. Keys are semantic (e.g. "nav.projects"). New strings are
 * added here; UI reads them via useT() from i18n.tsx. Rollout is incremental —
 * any string not yet keyed simply renders its Lao literal as before.
 */
export type Locale = "lo" | "th" | "en";
export const LOCALES: Locale[] = ["lo", "th", "en"];
export const LOCALE_META: Record<Locale, { label: string; short: string; flag: string }> = {
  lo: { label: "ລາວ", short: "ລາວ", flag: "🇱🇦" },
  th: { label: "ไทย", short: "ไทย", flag: "🇹🇭" },
  en: { label: "English", short: "EN", flag: "🇬🇧" },
};

export type Entry = Partial<Record<Locale, string>>;

export const DICT: Record<string, Entry> = {
  // Brand / shell
  "app.subtitle": { lo: "Sales & Installation", th: "ขายและติดตั้ง", en: "Sales & Installation" },
  "shell.opening": { lo: "ກຳລັງເປີດ Workspace...", th: "กำลังเปิด Workspace...", en: "Opening workspace..." },
  "shell.registerProject": { lo: "ລົງທະບຽນໂຄງການ", th: "ลงทะเบียนโครงการ", en: "Register project" },
  "shell.theme.toLight": { lo: "ປ່ຽນເປັນໂໝດສະຫວ່າງ", th: "เปลี่ยนเป็นโหมดสว่าง", en: "Switch to light mode" },
  "shell.theme.toDark": { lo: "ປ່ຽນເປັນໂໝດກາງຄືນ", th: "เปลี่ยนเป็นโหมดมืด", en: "Switch to dark mode" },
  "shell.openMenu": { lo: "ເປີດເມນູ", th: "เปิดเมนู", en: "Open menu" },
  "shell.closeMenu": { lo: "ປິດເມນູ", th: "ปิดเมนู", en: "Close menu" },
  "shell.profileSettings": { lo: "ໂປຣໄຟລ໌ & ການຕັ້ງຄ່າ", th: "โปรไฟล์และการตั้งค่า", en: "Profile & settings" },
  "shell.logout": { lo: "ອອກຈາກລະບົບ", th: "ออกจากระบบ", en: "Log out" },
  "shell.language": { lo: "ພາສາ", th: "ภาษา", en: "Language" },

  // Nav sections
  "nav.section.sales": { lo: "ການຂາຍ", th: "การขาย", en: "Sales" },
  "nav.section.work": { lo: "ໜ້າງານ & ຕິດຕັ້ງ", th: "หน้างานและติดตั้ง", en: "Work & Installation" },
  "nav.section.techs": { lo: "ທີມຊ່າງ", th: "ทีมช่าง", en: "Technicians" },
  "nav.section.inventory": { lo: "ສິນຄ້າ & ເບີກ", th: "สินค้าและเบิก", en: "Inventory & Requests" },
  "nav.section.ops": { lo: "ດຳເນີນງານ", th: "การดำเนินงาน", en: "Operations" },
  "nav.section.finance": { lo: "ການເງິນ & ລາຍງານ", th: "การเงินและรายงาน", en: "Finance & Reports" },
  "nav.section.system": { lo: "ລະບົບ", th: "ระบบ", en: "System" },

  // Nav items
  "nav.overview": { lo: "ພາບລວມ", th: "ภาพรวม", en: "Overview" },
  "nav.customers": { lo: "ລູກຄ້າ", th: "ลูกค้า", en: "Customers" },
  "nav.projects": { lo: "ໂຄງການ", th: "โครงการ", en: "Projects" },
  "nav.projectsMap": { lo: "ແຜນທີ່ໂຄງການ", th: "แผนที่โครงการ", en: "Projects Map" },
  "nav.approvals": { lo: "ລໍຖ້າອະນຸມັດ", th: "รออนุมัติ", en: "Pending approval" },
  "nav.materials": { lo: "ລວມວັດສະດຸ", th: "รวมวัสดุ", en: "All materials" },
  "nav.techcalendar": { lo: "ປະຕິທິນງານຊ່າງ", th: "ปฏิทินงานช่าง", en: "Craftsman calendar" },
  "nav.quotations": { lo: "ໃບສະເໜີລາຄາ", th: "ใบเสนอราคา", en: "Quotations" },
  "nav.contracts": { lo: "ສັນຍາ", th: "สัญญา", en: "Contracts" },
  "nav.boq": { lo: "BOQ", th: "BOQ", en: "BOQ" },
  "nav.schedule": { lo: "ຕາຕະລາງວຽກ", th: "ตารางงาน", en: "Schedule" },
  "nav.workorders": { lo: "ໃບງານ", th: "ใบสั่งงาน", en: "Work Orders" },
  "nav.stdtasks": { lo: "ງານຕິດຕັ້ງມາດຕະຖານ", th: "งานติดตั้งมาตรฐาน", en: "Standard Tasks" },
  "nav.techteams": { lo: "ຈັດການທີມຊ່າງ", th: "จัดการทีมช่าง", en: "Tech Teams" },
  "nav.techsummary": { lo: "ສະຫຼຸບຜົນງານຊ່າງ", th: "สรุปผลงานช่าง", en: "Tech Summary" },
  "nav.tracking": { lo: "ຕິດຕາມຊ່າງ", th: "ติดตามช่าง", en: "Track Technicians" },
  "nav.installtracking": { lo: "ຕິດຕາມການຕິດຕັ້ງ", th: "ติดตามการติดตั้ง", en: "Install Tracking" },
  "nav.requests": { lo: "ການຂໍເບີກ", th: "การเบิกของ", en: "Material Requests" },
  "nav.inventory": { lo: "ສິນຄ້າ / ສະຕັອກ", th: "สินค้า / สต็อก", en: "Inventory / Stock" },
  "nav.finance": { lo: "ບັນຊີ / ງວດຈ່າຍ", th: "บัญชี / งวดจ่าย", en: "Accounting / Payments" },
  "nav.reports": { lo: "ລາຍງານ & ສະຖິຕິ", th: "รายงานและสถิติ", en: "Reports & Stats" },
  "nav.users": { lo: "ຜູ້ໃຊ້ & ສິດ", th: "ผู้ใช้และสิทธิ์", en: "Users & Roles" },
  "nav.pushtest": { lo: "ທົດສອບແຈ້ງເຕືອນ", th: "ทดสอบการแจ้งเตือน", en: "Push Test" },

  // Page titles (breadcrumb / header)
  "title.registerProject": { lo: "ລົງທະບຽນໂຄງການ", th: "ลงทะเบียนโครงการ", en: "Register Project" },
  "title.projectDetail": { lo: "ລາຍລະອຽດໂຄງການ", th: "รายละเอียดโครงการ", en: "Project Details" },
  "title.profile": { lo: "ໂປຣໄຟລ໌ & ການຕັ້ງຄ່າ", th: "โปรไฟล์และการตั้งค่า", en: "Profile & Settings" },

  // ---- Common UI terms (reuse across all pages) ----
  // Actions
  "common.save": { lo: "ບັນທຶກ", th: "บันทึก", en: "Save" },
  "common.cancel": { lo: "ຍົກເລີກ", th: "ยกเลิก", en: "Cancel" },
  "common.delete": { lo: "ລຶບ", th: "ลบ", en: "Delete" },
  "common.edit": { lo: "ແກ້ໄຂ", th: "แก้ไข", en: "Edit" },
  "common.add": { lo: "ເພີ່ມ", th: "เพิ่ม", en: "Add" },
  "common.create": { lo: "ສ້າງ", th: "สร้าง", en: "Create" },
  "common.confirm": { lo: "ຢືນຢັນ", th: "ยืนยัน", en: "Confirm" },
  "common.search": { lo: "ຄົ້ນຫາ", th: "ค้นหา", en: "Search" },
  "common.close": { lo: "ປິດ", th: "ปิด", en: "Close" },
  "common.back": { lo: "ກັບຄືນ", th: "กลับ", en: "Back" },
  "common.view": { lo: "ເບິ່ງ", th: "ดู", en: "View" },
  "common.approve": { lo: "ອະນຸມັດ", th: "อนุมัติ", en: "Approve" },
  "common.reject": { lo: "ປະຕິເສດ", th: "ปฏิเสธ", en: "Reject" },
  "common.print": { lo: "ພິມ", th: "พิมพ์", en: "Print" },
  "common.export": { lo: "ສົ່ງອອກ", th: "ส่งออก", en: "Export" },
  "common.detail": { lo: "ລາຍລະອຽດ", th: "รายละเอียด", en: "Details" },
  "common.actions": { lo: "ຈັດການ", th: "จัดการ", en: "Actions" },
  // States / feedback
  "common.loading": { lo: "ກຳລັງໂຫຼດ...", th: "กำลังโหลด...", en: "Loading..." },
  "common.saving": { lo: "ກຳລັງບັນທຶກ...", th: "กำลังบันทึก...", en: "Saving..." },
  "common.noData": { lo: "ບໍ່ມີຂໍ້ມູນ", th: "ไม่มีข้อมูล", en: "No data" },
  "common.notFound": { lo: "ບໍ່ພົບຂໍ້ມູນ", th: "ไม่พบข้อมูล", en: "Not found" },
  "common.error": { lo: "ເກີດຂໍ້ຜິດພາດ", th: "เกิดข้อผิดพลาด", en: "An error occurred" },
  "common.success": { lo: "ສຳເລັດ", th: "สำเร็จ", en: "Success" },
  "common.required": { lo: "ຈຳເປັນ", th: "จำเป็น", en: "Required" },
  "common.all": { lo: "ທັງໝົດ", th: "ทั้งหมด", en: "All" },
  "common.total": { lo: "ລວມ", th: "รวม", en: "Total" },
  // Common fields / table headers
  "common.no": { lo: "ເລກທີ່", th: "เลขที่", en: "No." },
  "common.name": { lo: "ຊື່", th: "ชื่อ", en: "Name" },
  "common.date": { lo: "ວັນທີ", th: "วันที่", en: "Date" },
  "common.status": { lo: "ສະຖານະ", th: "สถานะ", en: "Status" },
  "common.amount": { lo: "ມູນຄ່າ", th: "มูลค่า", en: "Amount" },
  "common.qty": { lo: "ຈຳນວນ", th: "จำนวน", en: "Qty" },
  "common.price": { lo: "ລາຄາ", th: "ราคา", en: "Price" },
  "common.unit": { lo: "ໜ່ວຍ", th: "หน่วย", en: "Unit" },
  "common.note": { lo: "ໝາຍເຫດ", th: "หมายเหตุ", en: "Note" },
  "common.phone": { lo: "ເບີໂທ", th: "เบอร์โทร", en: "Phone" },
  "common.customer": { lo: "ລູກຄ້າ", th: "ลูกค้า", en: "Customer" },
  "common.createdBy": { lo: "ຜູ້ສ້າງ", th: "ผู้สร้าง", en: "Created by" },
  "common.approver": { lo: "ຜູ້ອະນຸມັດ", th: "ผู้อนุมัติ", en: "Approver" },
  // Common statuses
  "status.pending": { lo: "ລໍຖ້າອະນຸມັດ", th: "รออนุมัติ", en: "Pending" },
  "status.approved": { lo: "ອະນຸມັດແລ້ວ", th: "อนุมัติแล้ว", en: "Approved" },
  "status.rejected": { lo: "ປະຕິເສດ", th: "ปฏิเสธ", en: "Rejected" },
};
