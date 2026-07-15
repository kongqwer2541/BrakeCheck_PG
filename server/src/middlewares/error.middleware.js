const genericServerErrorMessage = 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
const payloadTooLargeMessage = 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป กรุณาลดขนาดข้อมูลแล้วลองใหม่';

function getStatusCode(error) {
  const statusCode = Number(error.statusCode || 500);

  if (statusCode >= 400 && statusCode < 600) {
    return statusCode;
  }

  return 500;
}

function getResponseMessage(error, statusCode, isUserFacingError) {
  if (statusCode === 413) {
    return payloadTooLargeMessage;
  }

  if (isUserFacingError) {
    return error.message || 'คำขอไม่ถูกต้อง';
  }

  return genericServerErrorMessage;
}

export function errorMiddleware(error, req, res, next) {
  const statusCode = getStatusCode(error);
  const isUserFacingError = statusCode >= 400 && statusCode < 500;
  const response = {
    ok: false,
    message: getResponseMessage(error, statusCode, isUserFacingError)
  };

  if (error.details && isUserFacingError) {
    response.details = error.details;
  }

  res.status(statusCode).json(response);
}
