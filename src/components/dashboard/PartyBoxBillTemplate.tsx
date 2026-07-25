import React from 'react';
import { format } from 'date-fns';

interface PartyBoxBillPrintData {
  id: string;
  partyId: string;
  partyName: string;
  billDate: any;
  prevBalanceBox: number;
  todaysFishBox: number;
  totalBox: number;
  emptyBox: number;
  balanceBox: number;
  description?: string;
  driverMobile?: string;
  driverName?: string;
  vehicleNo?: string;
}

interface PartyBoxBillTemplateProps {
  id?: string;
  className?: string;
  billData: PartyBoxBillPrintData;
}

export function PartyBoxBillTemplate({ id, className, billData }: PartyBoxBillTemplateProps) {
  const { 
    id: billNo, 
    partyId, 
    partyName, 
    billDate, 
    prevBalanceBox, 
    todaysFishBox, 
    totalBox, 
    emptyBox, 
    balanceBox, 
    description, 
    driverMobile, 
    driverName, 
    vehicleNo 
  } = billData;
  
  const parsedDate = billDate?.seconds ? new Date(billDate.seconds * 1000) : new Date(billDate || Date.now());

  return (
    <div id={id} className={`box-bill-template-root ${className || ''}`}>
      <header className="bb-header">
        <div className="bb-company-name">M.C &amp; SONS FISH COMPANY</div>
        <div className="bb-address">Shop No 1 : Fish Market, Santhaipettai,</div>
        <div className="bb-address">Thennampalayam, Palladam Road - Tiruppur - 641604</div>
      </header>

      <div className="bb-info-section">
        <div>
          <div><span className="bb-info-label">Id</span> <span className="bb-info-colon">:</span> <strong>{partyId}</strong></div>
          <div><span className="bb-info-label">Name</span> <span className="bb-info-colon">:</span> <strong>{partyName}</strong></div>
        </div>
        <div className="bb-info-right">
          <div><span className="bb-info-label">Bill No</span> <span className="bb-info-colon">:</span> <strong>{billNo}</strong></div>
          <div><span className="bb-info-label">Date</span> <span className="bb-info-colon">:</span> <strong>{format(parsedDate, 'dd-MM-yyyy')}</strong></div>
        </div>
      </div>

      <table className="bb-main-table">
        <tbody>
          <tr>
            <td className="bb-td-label">Previous Balance Box</td>
            <td className="bb-td-value">{prevBalanceBox}</td>
            <td className="bb-td-right">
                <div className="bb-driver-row">
                    <span className="bb-driver-label">Driver Name</span> <span className="bb-driver-colon">:</span> <span className="bb-driver-val">{driverName || ''}</span>
                </div>
            </td>
          </tr>
          <tr>
            <td className="bb-td-label">Today's Fish Box</td>
            <td className="bb-td-value">{todaysFishBox}</td>
            <td className="bb-td-right">
                <div className="bb-driver-row">
                    <span className="bb-driver-label">Mobile No</span> <span className="bb-driver-colon">:</span> <span className="bb-driver-val">{driverMobile || ''}</span>
                </div>
            </td>
          </tr>
          <tr>
            <td className="bb-td-label">Total Box</td>
            <td className="bb-td-value">{totalBox}</td>
            <td className="bb-td-right">
                <div className="bb-driver-row">
                    <span className="bb-driver-label">Vehicle No</span> <span className="bb-driver-colon">:</span> <span className="bb-driver-val">{vehicleNo || ''}</span>
                </div>
            </td>
          </tr>
          <tr>
            <td className="bb-td-label">Empty Box</td>
            <td className="bb-td-value">{emptyBox}</td>
            <td className="bb-td-right"></td>
          </tr>
          <tr className="bb-final-row">
            <td className="bb-td-label">Total Balance Box</td>
            <td className="bb-td-value">{balanceBox}</td>
            <td className="bb-td-right"></td>
          </tr>
        </tbody>
      </table>

      <div className="bb-note-section">
        <span className="bb-note-bold">NOTE : </span><span className="bb-note-text">{description || '-'}</span>
      </div>

      <div className="bb-footer">
        Developed By MC &amp; SONS
      </div>
    </div>
  );
}
