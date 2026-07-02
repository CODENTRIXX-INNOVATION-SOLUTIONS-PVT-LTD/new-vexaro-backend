'use strict';

const { parseFileBuffer } = require('../services/shipment-bulk.service');
const xlsx = require('xlsx');

describe('Shipment Bulk Excel Upload Parsing', () => {
  const REQUIRED_HEADERS = [
    'origin_name', 'origin_phone', 'origin_address', 'origin_city', 'origin_state', 'origin_pincode',
    'dest_name', 'dest_phone', 'dest_address', 'dest_city', 'dest_state', 'dest_pincode', 'weight',
  ];

  test('should parse valid Excel file successfully', () => {
    // Generate valid workbook in memory
    const headers = [
      'Origin_Name', 'Origin_Phone', 'Origin_Address', 'Origin_City', 'Origin_State', 'Origin_Pincode',
      'Dest_Name', 'Dest_Phone', 'Dest_Address', 'Dest_City', 'Dest_State', 'Dest_Pincode', 'Weight',
      'Is_COD', 'COD_Amount', 'Order_Ref'
    ];
    const dataRow = [
      'John Store', '9876543210', '123 Origin St', 'Mumbai', 'Maharashtra', '400001',
      'Sarah Dest', '9876543211', '456 Dest Road', 'Pune', 'Maharashtra', '411001', '1.5',
      'true', '500', 'REF-001'
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, dataRow]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Shipments');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseFileBuffer(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    expect(result.isCsv).toBe(false);
    expect(result.rows).toHaveLength(1);
    
    const parsedRow = result.rows[0];
    expect(parsedRow['origin_name']).toBe('John Store');
    expect(parsedRow['origin_phone']).toBe('9876543210');
    expect(parsedRow['weight']).toBe('1.5');
    expect(parsedRow['is_cod']).toBe('true');
    expect(parsedRow['cod_amount']).toBe('500');
    expect(parsedRow['order_ref']).toBe('REF-001');
  });

  test('should normalise and trim keys and values correctly', () => {
    const headers = ['  Origin_Name  ', 'Weight'];
    const dataRow = ['  My Shop  ', ' 2.5 '];

    const ws = xlsx.utils.aoa_to_sheet([headers, dataRow]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseFileBuffer(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(result.rows[0]['origin_name']).toBe('My Shop');
    expect(result.rows[0]['weight']).toBe('2.5');
  });

  test('should throw error for empty sheet', () => {
    const ws = xlsx.utils.aoa_to_sheet([]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => {
      parseFileBuffer(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }).toThrow('Excel file is empty');
  });

  test('should throw error for corrupted excel buffer', () => {
    const spy = jest.spyOn(xlsx, 'read').mockImplementationOnce(() => {
      throw new Error('Corrupted ZIP file');
    });

    expect(() => {
      parseFileBuffer(Buffer.from([]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }).toThrow('Excel parse error: Corrupted ZIP file');

    spy.mockRestore();
  });
});
