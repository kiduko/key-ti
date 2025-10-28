export interface TimeRemaining {
  seconds: number;
  text: string;
  className: string;
}

export const calculateTimeRemaining = (expirationStr: string): TimeRemaining => {
  const expiration = new Date(expirationStr);
  const now = new Date();
  const seconds = Math.floor((expiration.getTime() - now.getTime()) / 1000);

  if (seconds <= 0) {
    return { seconds: 0, text: '만료됨', className: 'time-expired' };
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let className = 'time-normal';
  if (seconds < 300) className = 'time-critical';
  else if (seconds < 3600) className = 'time-warning';

  return {
    seconds,
    text: `${hours}시간 ${minutes}분 ${secs}초`,
    className,
  };
};

export const getOTPTimerClass = (timeRemaining: number): string => {
  if (timeRemaining < 5) return 'critical';
  if (timeRemaining < 10) return 'warning';
  return '';
};
