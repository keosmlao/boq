"use client";


import { Suspense } from "react";
import { getProjectsBoqClose } from "@/_actions/projects";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from "next/navigation";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---- Utils ----
function formatDateDMY(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const ProjectListClosePrint = () => {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printData, setPrintData] = useState({
    title: 'ລາຍງານໂຄງການທີ່ປິດແລ້ວ',
    dateFrom: '',
    dateTo: '',
    status: '',
    generatedDate: new Date().toLocaleDateString('lo-LA'),
    generatedBy: ''
  });

  useEffect(() => {
    // Get user info
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setPrintData(prev => ({
          ...prev,
          generatedBy: user.username || user.name || 'ບໍ່ລະບຸ'
        }));
      } catch {/* ignore */}
    }

    // Get filter parameters from URL
    const projectId = searchParams.get('projectId') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    
    // Update title based on whether it's individual project or all projects
    const title = projectId ? 'ລາຍງານໂຄງການທີ່ປິດແລ້ວ (ໂຄງການດຽວ)' : 'ລາຍງານໂຄງການທີ່ປິດແລ້ວ';
    
    setPrintData(prev => ({
      ...prev,
      title,
      status,
      dateFrom,
      dateTo
    }));

    fetchProjects();
  }, [searchParams]);

  const fetchProjects = async () => {
    try {
      const resp = await getProjectsBoqClose();
      const serverData = Array.isArray(resp) ? resp : [];
      
      let filtered = serverData.map((p, idx) => {
        let status;
        if (p.approve_status === 1) {
          status = 'ປີດໂຄງການແລ້ວ';
        } else if (p.approve_status === 0) {
          status = 'ລໍຖ້າອະນຸມັດປິດໂຄງການ';
        } else {
          status = 'ລໍຖ້າອະນຸມັດປິດໂຄງການ';
        }

        return {
          id: p.id ?? idx + 1,
          project_name: p.project_name ?? '-',
          village_name: p.village_name ?? '-',
          district_name: p.district_name ?? '-',
          province_name: p.province_name ?? '-',
          coordinator: p.coordinator ?? '-',
          phone: p.phone ?? '-',
          status,
          sml_code: p.sml_code ?? '',
          close_date: p.close_date ?? '',
          closer: p.closer ?? '-',
          approve_status: p.approve_status ?? 0,
          created_at: p.created_at ?? '',
          customer_type: p.customer_type ?? '',
          installation_type: p.installation_type ?? '',
          equipment_type: p.equipment_type ?? '',
          priority: p.priority ?? '',
          project_status: p.project_status ?? '',
          sale_name: p.sale_name ?? '',
          image_url: p.image_url ?? '',
          contractlist: Array.isArray(p.contractlist) ? p.contractlist : [],
        };
      });

      // Apply filters based on URL parameters
      const projectIdFilter = searchParams.get('projectId');
      const statusFilter = searchParams.get('status');
      const dateFromFilter = searchParams.get('dateFrom');
      const dateToFilter = searchParams.get('dateTo');

      // Filter by specific project ID if provided
      if (projectIdFilter) {
        filtered = filtered.filter(p => p.id.toString() === projectIdFilter);
      }

      if (statusFilter && statusFilter !== 'ທັງໝົດ') {
        filtered = filtered.filter(p => p.status === statusFilter);
      }

      if (dateFromFilter || dateToFilter) {
        const toDateOnly = d => {
          if (!d) return null;
          const dd = new Date(d);
          if (isNaN(dd.getTime())) return null;
          dd.setHours(0, 0, 0, 0);
          return dd;
        };

        if (dateFromFilter) {
          const fd = toDateOnly(dateFromFilter);
          if (fd) {
            filtered = filtered.filter(p => {
              const pd = toDateOnly(p.close_date);
              return !pd || pd >= fd;
            });
          }
        }

        if (dateToFilter) {
          const td = toDateOnly(dateToFilter);
          if (td) {
            filtered = filtered.filter(p => {
              const pd = toDateOnly(p.close_date);
              return !pd || pd <= td;
            });
          }
        }
      }

      setProjects(filtered);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto print when component loads
  useEffect(() => {
    if (!loading && projects.length > 0) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, projects]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[var(--theme-primary)] mx-auto mb-4"></div>
          <p className="text-gray-600">ກຳລັງກະກຽມຂໍ້ມູນສຳລັບພິມ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="print-container">
      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print-container { 
            width: 100%; 
            max-width: none; 
            margin: 0; 
            padding: 20px;
            font-size: 12px;
          }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          .contract-section { page-break-inside: avoid; }
        }
        
        @media screen {
          .print-container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
            background: white;
            min-height: 100vh;
          }
        }
        
        .header-section {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        
        .filter-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
          border: 1px solid #dee2e6;
        }
        
        .project-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 11px;
        }
        
        .project-table th,
        .project-table td {
          border: 1px solid #333;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }
        
        .project-table th {
          background-color: #f1f3f4;
          font-weight: bold;
          text-align: center;
        }
        
        .contract-section {
          margin-top: 15px;
          margin-bottom: 20px;
          border: 1px solid #ccc;
          border-radius: 5px;
          overflow: hidden;
        }
        
        .contract-header {
          background: #e9ecef;
          padding: 10px;
          font-weight: bold;
          border-bottom: 1px solid #ccc;
        }
        
        .boq-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        
        .boq-table th,
        .boq-table td {
          border: 1px solid #ddd;
          padding: 5px;
          text-align: center;
        }
        
        .boq-table th {
          background-color: #f8f9fa;
        }
        
        .summary-section {
          margin-top: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        
        .signature-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
        }
        
        .signature-box {
          text-align: center;
          width: 200px;
        }
      `}</style>

      {/* Header */}
      <div className="header-section">
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          {printData.title}
        </h1>
        <p style={{ fontSize: '14px', margin: '5px 0', color: '#666' }}>
          ລາຍງານໂຄງການທີ່ດຳເນີນການສຳເລັດແລ້ວ
        </p>
        <p style={{ fontSize: '12px', margin: '5px 0', color: '#666' }}>
          ວັນທີອອກລາຍງານ: {printData.generatedDate} | ຜູ້ອອກລາຍງານ: {printData.generatedBy}
        </p>
      </div>

      {/* Filter Information */}
      <div className="filter-info">
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>ເງື່ອນໄຂການກັ່ນຕອງ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', fontSize: '12px' }}>
          <div>
            <strong>ສະຖານະ:</strong> {printData.status || 'ທັງໝົດ'}
          </div>
          <div>
            <strong>ວັນທີເລີ່ມຕົ້ນ:</strong> {printData.dateFrom ? formatDateDMY(printData.dateFrom) : 'ບໍ່ຈຳກັດ'}
          </div>
          <div>
            <strong>ວັນທີສິ້ນສຸດ:</strong> {printData.dateTo ? formatDateDMY(printData.dateTo) : 'ບໍ່ຈຳກັດ'}
          </div>
          <div>
            <strong>ໂຄງການສະເພາະ:</strong> {searchParams.get('projectId') ? `ID: ${searchParams.get('projectId')}` : 'ທັງໝົດ'}
          </div>
        </div>
      </div>

      {/* Projects List */}
      {projects.map((project, projectIdx) => (
        <div key={project.id} className="project-section" style={{ marginBottom: '40px' }}>
          {/* Project Summary Table */}
          <table className="project-table">
            <thead>
              <tr>
                <th colSpan="4" style={{ fontSize: '14px', background: '#333', color: 'white' }}>
                  ໂຄງການທີ່ {projectIdx + 1}: {project.project_name}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', width: '15%' }}>ລະຫັດໂຄງການ:</td>
                <td style={{ width: '35%' }}>{project.sml_code}</td>
                <td style={{ fontWeight: 'bold', width: '15%' }}>ສະຖານະ:</td>
                <td style={{ width: '35%' }}>{project.status}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>ຜູ້ປະສານງານ:</td>
                <td>{project.coordinator}</td>
                <td style={{ fontWeight: 'bold' }}>ເບີໂທ:</td>
                <td>{project.phone}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>ທີ່ຢູ່:</td>
                <td colSpan="3">{project.village_name}, {project.district_name}, {project.province_name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>ວັນທີສ້າງ:</td>
                <td>{project.created_at}</td>
                <td style={{ fontWeight: 'bold' }}>ວັນທີປິດ:</td>
                <td>{formatDateDMY(project.close_date)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>ຜູ້ຂາຍ:</td>
                <td>{project.sale_name}</td>
                <td style={{ fontWeight: 'bold' }}>ຜູ້ປິດໂຄງການ:</td>
                <td>{project.closer}</td>
              </tr>
            </tbody>
          </table>

          {/* Contracts */}
          {project.contractlist && project.contractlist.length > 0 && (
            <div>
              <h4 style={{ margin: '20px 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
                ລາຍການສັນຍາ ({project.contractlist.length} ສັນຍາ)
              </h4>
              
              {project.contractlist.map((contract, contractIdx) => (
                <div key={contractIdx} className="contract-section">
                  <div className="contract-header">
                    ສັນຍາທີ່ {contractIdx + 1}: {contract.contract_name} (ເລກທີ: {contract.contract_no}) | 
                    ລູກຄ້າ: {contract.cust_code} | 
                    ວັນເລີ່ມ: {formatDateDMY(contract.start_date)}
                    {contract.approve_status_1 === 1 && (
                      <span style={{ color: 'green', marginLeft: '10px' }}>
                        ✓ ອະນຸມັດໂດຍ: {contract.approver_1}
                      </span>
                    )}
                  </div>
                  
                  {/* BOQ Table */}
                  {contract.boq_list && contract.boq_list.length > 0 && (
                    <table className="boq-table">
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>ລຳດັບ</th>
                          <th style={{ width: '15%' }}>ລະຫັດສິນຄ້າ</th>
                          <th style={{ width: '35%' }}>ລາຍການສິນຄ້າ</th>
                          <th style={{ width: '8%' }}>ຈຳນວນ BOQ</th>
                          <th style={{ width: '7%' }}>ໜ່ວຍ</th>
                          <th style={{ width: '10%' }}>ຂໍເບີກ</th>
                          <th style={{ width: '10%' }}>ເບີກແລ້ວ</th>
                          <th style={{ width: '10%' }}>ຄົງເຫຼືອ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contract.boq_list.map((item, itemIdx) => (
                          <tr key={itemIdx}>
                            <td>{itemIdx + 1}</td>
                            <td>{item.item_code}</td>
                            <td style={{ textAlign: 'left' }}>{item.item_name}</td>
                            <td>{Number(item.boq_qty ?? 0).toLocaleString()}</td>
                            <td>{item.unit_code}</td>
                            <td>{Number(item.request ?? 0).toLocaleString()}</td>
                            <td>{Number(item.withdraw ?? 0).toLocaleString()}</td>
                            <td>{Number(item.balance ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  
                  {/* Attachments */}
                  {contract.att_list && contract.att_list.length > 0 && (
                    <div style={{ padding: '10px', backgroundColor: '#f8f9fa', fontSize: '11px' }}>
                      <strong>ໄຟລ໌ແນບ:</strong> {contract.att_list.map(att => att.file_name).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {projectIdx < projects.length - 1 && <div className="page-break"></div>}
        </div>
      ))}

      {/* Summary */}
      <div className="summary-section">
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>ສະຫຼຸບລາຍງານ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <strong>ຈຳນວນໂຄງການທັງໝົດ:</strong> {projects.length} ໂຄງການ
          </div>
          <div>
            <strong>ຈຳນວນສັນຍາທັງໝົດ:</strong> {projects.reduce((sum, p) => sum + (p.contractlist?.length || 0), 0)} ສັນຍາ
          </div>
          <div>
            <strong>ຈຳນວນລາຍການ BOQ:</strong> {projects.reduce((sum, p) => 
              sum + (p.contractlist?.reduce((contractSum, c) => 
                contractSum + (c.boq_list?.length || 0), 0) || 0), 0)} ລາຍການ
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="signature-section">
        <div className="signature-box">
          <p style={{ margin: '0 0 40px 0', fontWeight: 'bold' }}>ຜູ້ກະກຽມລາຍງານ</p>
          <p style={{ margin: '0', borderTop: '1px solid #333', paddingTop: '5px' }}>
            {printData.generatedBy}
          </p>
        </div>
        <div className="signature-box">
          <p style={{ margin: '0 0 40px 0', fontWeight: 'bold' }}>ຜູ້ອະນຸມັດ</p>
          <p style={{ margin: '0', borderTop: '1px solid #333', paddingTop: '5px' }}>
            ( _________________________ )
          </p>
        </div>
        <div className="signature-box">
          <p style={{ margin: '0 0 40px 0', fontWeight: 'bold' }}>ວັນທີ</p>
          <p style={{ margin: '0', borderTop: '1px solid #333', paddingTop: '5px' }}>
            {printData.generatedDate}
          </p>
        </div>
      </div>

      {/* No Print Buttons */}
      <div className="no-print" style={{ 
        position: 'fixed', 
        top: '20px', 
        right: '20px', 
        display: 'flex', 
        gap: '10px' 
      }}>
        <button 
          onClick={() => window.print()}
          style={{
            padding: '10px 15px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🖨️ ພິມ
        </button>
        <button 
          onClick={() => window.history.back()}
          style={{
            padding: '10px 15px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          ← ກັບຄືນ
        </button>
      </div>
    </div>
  );
};

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProjectListClosePrint />
    </Suspense>
  );
}
