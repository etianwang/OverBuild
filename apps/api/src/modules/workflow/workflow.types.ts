export interface ApprovalTemplateNode {
  node: number;
  role: string;
  condition?: string;
}

export const APPROVAL_TYPE_LABEL: Record<string, string> = {
  purchase_request: '采购申请',
  payment: '付款',
  reimbursement: '报销',
  contract: '合同签订',
  drawing: '图纸发布',
};

export const PAYMENT_AMOUNT_LIMIT = 100_000;
