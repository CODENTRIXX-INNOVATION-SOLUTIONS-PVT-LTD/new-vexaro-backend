'use strict';

const exportService = require('../export.service');
const { ExportJob, ExportJobStatus, ExportJobType, ExportJobFormat } = require('../export-job.model');
const reportRepository = require('../report.repository');
const { UserRole } = require('../../../constants');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Mock dependencies
jest.mock('../export-job.model');
jest.mock('../report.repository');
jest.mock('../../../utils/email', () => ({
  sendExportReadyEmail: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Export Service', () => {
  const userId = '507f1f77bcf86cd799439011';
  const otherUserId = '507f1f77bcf86cd799439012';
  const jobId = 'EXP-123456-abcd';

  const mockUser = {
    userId,
    email: 'user@example.com',
    role: UserRole.MERCHANT,
    firstName: 'John',
  };

  const mockJob = {
    jobId,
    userId,
    type: ExportJobType.SHIPMENTS,
    format: ExportJobFormat.CSV,
    status: ExportJobStatus.PENDING,
    filter: {
      mongoQuery: { deletedAt: null },
      dateFrom: new Date(Date.now() - 100000).toISOString(),
      dateTo: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createExportJobService', () => {
    test('should create export job successfully', async () => {
      ExportJob.create.mockResolvedValue(mockJob);

      const result = await exportService.createExportJobService(
        { type: ExportJobType.SHIPMENTS, format: ExportJobFormat.CSV },
        mockUser
      );

      expect(ExportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: ExportJobType.SHIPMENTS,
          format: ExportJobFormat.CSV,
          status: ExportJobStatus.PENDING,
        })
      );
      expect(result).toEqual(mockJob);
    });

    test('should throw error for invalid export type', async () => {
      await expect(
        exportService.createExportJobService({ type: 'INVALID', format: ExportJobFormat.CSV }, mockUser)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('should throw error for invalid format', async () => {
      await expect(
        exportService.createExportJobService({ type: ExportJobType.SHIPMENTS, format: 'INVALID' }, mockUser)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('should throw error if date range exceeds 1 year', async () => {
      const longTimeAgo = new Date();
      longTimeAgo.setFullYear(longTimeAgo.getFullYear() - 2);

      await expect(
        exportService.createExportJobService(
          {
            type: ExportJobType.SHIPMENTS,
            format: ExportJobFormat.CSV,
            dateFrom: longTimeAgo.toISOString(),
          },
          mockUser
        )
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('getExportJobStatusService', () => {
    test('should return status for job owner', async () => {
      ExportJob.findOne.mockResolvedValue(mockJob);

      const result = await exportService.getExportJobStatusService(jobId, mockUser);
      expect(result).toEqual(mockJob);
    });

    test('should throw 403 for non-owner user', async () => {
      ExportJob.findOne.mockResolvedValue(mockJob);

      await expect(
        exportService.getExportJobStatusService(jobId, { userId: otherUserId, role: UserRole.MERCHANT })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('should allow super admin to view status of any job', async () => {
      ExportJob.findOne.mockResolvedValue(mockJob);

      const result = await exportService.getExportJobStatusService(jobId, {
        userId: otherUserId,
        role: UserRole.SUPER_ADMIN,
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('processExportJobAsync worker', () => {
    test('should process shipments export job and update status to COMPLETED', async () => {
      ExportJob.findOne.mockResolvedValue({
        ...mockJob,
        status: ExportJobStatus.PENDING,
      });

      const mockCursor = {
        next: jest
          .fn()
          .mockResolvedValueOnce({
            awb: 'AWB-1',
            status: 'ORDER_CREATED',
            weight: 1.2,
            isCOD: false,
            createdAt: new Date(),
          })
          .mockResolvedValueOnce(null),
      };
      reportRepository.shipmentCursor.mockReturnValue(mockCursor);

      const spyWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      await exportService.processExportJobAsync(jobId, mockUser);

      expect(ExportJob.updateOne).toHaveBeenCalledWith({ jobId }, { status: ExportJobStatus.PROCESSING });
      expect(spyWriteFileSync).toHaveBeenCalled();
      expect(ExportJob.updateOne).toHaveBeenCalledWith(
        { jobId },
        expect.objectContaining({
          status: ExportJobStatus.COMPLETED,
          fileUrl: expect.any(String),
          filePath: expect.any(String),
        })
      );

      spyWriteFileSync.mockRestore();
    });
  });
});
