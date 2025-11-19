import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { api } from "@/utils/apiClient";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/components/ToastContainer";

interface PurchaseHistory {
  id: string;
  planCode: string;
  datacenter: string;
  options?: string[];
  status: "success" | "failed";
  orderId?: string;
  orderUrl?: string;
  errorMessage?: string;
  purchaseTime: string;
  expirationTime?: string; // 订单过期时间（可选，如果没有则从 purchaseTime + 24小时计算）
  price?: {
    withTax?: number;
    withoutTax?: number;
    tax?: number;
    currencyCode?: string;
  };
}

// 订单有效期（分钟）- OVH 订单通常为 15 分钟
const ORDER_VALIDITY_MINUTES = 15;

// 计算订单过期时间
const getExpirationTime = (purchaseTime: string, expirationTime?: string): Date => {
  if (expirationTime) {
    return new Date(expirationTime);
  }
  // 如果没有提供过期时间，从购买时间 + 15分钟计算
  const purchaseDate = new Date(purchaseTime);
  return new Date(purchaseDate.getTime() + ORDER_VALIDITY_MINUTES * 60 * 1000);
};

// 格式化倒计时显示
const formatCountdown = (remainingMs: number): string => {
  if (remainingMs <= 0) {
    return "已过期";
  }
  
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}时${minutes}分${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
};

// 倒计时 Hook
const useOrderCountdown = (purchaseTime: string, expirationTime?: string) => {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  
  const expiration = useMemo(() => getExpirationTime(purchaseTime, expirationTime), [purchaseTime, expirationTime]);
  
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const exp = expiration.getTime();
      const remaining = exp - now;
      
      setRemainingMs(remaining);
      setIsExpired(remaining <= 0);
    };
    
    // 立即更新一次
    updateCountdown();
    
    // 每秒更新一次
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [expiration]);
  
  return {
    remainingMs,
    isExpired,
    expirationTime: expiration,
    countdownText: formatCountdown(remainingMs)
  };
};

// 移动端订单卡片组件
const MobileOrderCard = ({ item }: { item: PurchaseHistory }) => {
  const showCountdown = item.status === "success" && item.orderId;
  const countdown = showCountdown ? useOrderCountdown(item.purchaseTime, item.expirationTime) : null;
  const isExpired = countdown?.isExpired ?? false;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 bg-cyber-grid/10 rounded-lg border border-cyber-accent/20 space-y-2 ${
        isExpired ? "opacity-60" : ""
      }`}
    >
      <div className="flex justify-between items-start">
        <div className={isExpired ? "line-through" : ""}>
          <div className="font-medium text-cyber-accent text-sm">{item.planCode}</div>
          <div className="text-xs text-cyber-text-dimmed mt-1">
            {item.datacenter.toUpperCase()} · {new Date(item.purchaseTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            item.status === "success" 
              ? "bg-green-500/20 text-green-400" 
              : "bg-red-500/20 text-red-400"
          }`}>
            {item.status === "success" ? "成功" : "失败"}
          </span>
          {showCountdown && (
            <div className={`text-[10px] px-2 py-0.5 rounded ${
              isExpired 
                ? "bg-red-500/20 text-red-400" 
                : countdown && countdown.remainingMs < 300000
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-blue-500/20 text-blue-400"
            }`}>
              {isExpired ? "订单支付已过期" : countdown?.countdownText}
            </div>
          )}
        </div>
      </div>
      
      {item.options && item.options.length > 0 && (
        <div className={`text-xs text-cyber-text-dimmed pt-2 border-t border-cyber-grid/30 ${isExpired ? "line-through" : ""}`}>
          <span className="text-cyber-muted">配置：</span> {item.options.join(', ')}
        </div>
      )}
      
      {item.price && item.price.withTax !== undefined && (
        <div className={`text-sm font-medium text-green-400 pt-2 border-t border-cyber-grid/30 ${isExpired ? "line-through" : ""}`}>
          <span className="text-cyber-muted">价格：</span> {item.price.withTax} {item.price.currencyCode || 'EUR'}
          {item.price.withoutTax !== undefined && item.price.withoutTax !== item.price.withTax && (
            <span className="text-xs text-cyber-text-dimmed ml-1">
              (不含税: {item.price.withoutTax} {item.price.currencyCode || 'EUR'})
            </span>
          )}
        </div>
      )}
      
      {item.orderId && (
        <div className={`text-xs text-cyber-text-dimmed ${isExpired ? "line-through" : ""}`}>
          <span className="text-cyber-muted">订单ID：</span> {item.orderId}
        </div>
      )}
      
      {item.status === "success" && item.orderUrl ? (
        <a 
          href={item.orderUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`inline-block mt-2 px-3 py-1 text-xs text-cyber-accent border border-cyber-accent/30 rounded hover:bg-cyber-accent/10 transition-colors ${
            isExpired ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          查看订单
        </a>
      ) : item.status === "failed" && item.errorMessage ? (
        <button
          onClick={() => toast.info(item.errorMessage || "")}
          className="inline-block mt-2 px-3 py-1 text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
        >
          查看错误
        </button>
      ) : null}
    </motion.div>
  );
};

// 桌面端订单行组件
const DesktopOrderRow = ({ item }: { item: PurchaseHistory }) => {
  const showCountdown = item.status === "success" && item.orderId;
  const countdown = showCountdown ? useOrderCountdown(item.purchaseTime, item.expirationTime) : null;
  const isExpired = countdown?.isExpired ?? false;
  
  return (
    <motion.tr 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`hover:bg-cyber-grid/10 transition-colors ${isExpired ? "opacity-60" : ""}`}
    >
      <td className="px-3 py-2.5 font-medium text-cyber-accent text-xs">
        <div className={`max-w-[120px] truncate ${isExpired ? "line-through" : ""}`} title={item.planCode}>
          {item.planCode}
        </div>
      </td>
      <td className={`px-3 py-2.5 text-cyber-text-dimmed text-xs whitespace-nowrap ${isExpired ? "line-through" : ""}`}>
        {item.datacenter.toUpperCase()}
      </td>
      <td className={`px-3 py-2.5 text-xs text-cyber-text-dimmed max-w-[200px] ${isExpired ? "line-through" : ""}`}>
        <div className="break-words line-clamp-2" title={item.options && item.options.length > 0 ? item.options.join(', ') : '默认配置'}>
          {item.options && item.options.length > 0 
            ? item.options.join(', ')
            : '默认配置'}
        </div>
      </td>
      <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${isExpired ? "line-through" : ""}`}>
        {item.price && item.price.withTax !== undefined ? (
          <div>
            <div className="font-medium text-green-400">
              {item.price.withTax} {item.price.currencyCode || 'EUR'}
            </div>
            {item.price.withoutTax !== undefined && item.price.withoutTax !== item.price.withTax && (
              <div className="text-[10px] text-cyber-text-dimmed">
                (含税 {item.price.tax})
              </div>
            )}
          </div>
        ) : (
          <span className="text-cyber-text-dimmed">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
            item.status === "success" 
              ? "bg-green-500/20 text-green-400" 
              : "bg-red-500/20 text-red-400"
          }`}>
            {item.status === "success" ? "成功" : "失败"}
          </span>
          {showCountdown && (
            <div className={`text-[9px] px-1.5 py-0.5 rounded ${
              isExpired 
                ? "bg-red-500/20 text-red-400" 
                : countdown && countdown.remainingMs < 300000
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-blue-500/20 text-blue-400"
            }`}>
              {isExpired ? "订单支付已过期" : countdown?.countdownText}
            </div>
          )}
        </div>
      </td>
      <td className={`px-3 py-2.5 text-cyber-text-dimmed text-xs ${isExpired ? "line-through" : ""}`}>
        <div className="max-w-[140px] truncate" title={new Date(item.purchaseTime).toLocaleString()}>
          {new Date(item.purchaseTime).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).replace(/\//g, '-')}
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {item.status === "success" && item.orderUrl ? (
          <a 
            href={item.orderUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`text-cyber-accent hover:text-cyber-accent/80 transition-colors text-xs ${
              isExpired ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            订单
          </a>
        ) : item.status === "failed" && item.errorMessage ? (
          <button
            onClick={() => toast.info(item.errorMessage || "")}
            className="text-red-400 hover:text-red-400/80 transition-colors text-xs"
          >
            错误
          </button>
        ) : (
          "-"
        )}
        {item.orderId && (
          <div className={`text-[10px] text-cyber-text-dimmed mt-0.5 max-w-[100px] truncate ${isExpired ? "line-through" : ""}`} title={item.orderId}>
            {item.orderId}
          </div>
        )}
      </td>
    </motion.tr>
  );
};

const HistoryPage = () => {
  const isMobile = useIsMobile();
  const { showConfirm } = useToast();
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // 区分初始加载和刷新
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredHistory, setFilteredHistory] = useState<PurchaseHistory[]>([]);

  // Fetch purchase history
  const fetchHistory = async (isRefresh = false) => {
    // 如果是刷新，只设置刷新状态，不改变加载状态
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const response = await api.get(`/purchase-history`);
      setHistory(response.data);
      setFilteredHistory(response.data);
    } catch (error) {
      console.error("Error fetching purchase history:", error);
      toast.error("获取购买历史记录失败");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Clear history
  const clearHistory = async () => {
    const confirmed = await showConfirm({
      title: '确认清空',
      message: '确定要清空所有购买历史记录吗？\n此操作不可撤销。',
      confirmText: '确认清空',
      cancelText: '取消'
    });
    
    if (!confirmed) {
      return;
    }
    
    try {
      await api.delete(`/purchase-history`);
      toast.success("已清空购买历史记录");
      fetchHistory(true);
    } catch (error) {
      console.error("Error clearing purchase history:", error);
      toast.error("清空购买历史记录失败");
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, []);

  // Apply filters
  useEffect(() => {
    if (history.length === 0) return;
    
    let filtered = [...history];
    
    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(item => item.status === filterStatus);
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        item => 
          item.planCode.toLowerCase().includes(term) ||
          item.datacenter.toLowerCase().includes(term) ||
          (item.orderId && item.orderId.toLowerCase().includes(term))
      );
    }
    
    setFilteredHistory(filtered);
  }, [history, filterStatus, searchTerm]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-1 cyber-glow-text">抢购历史</h1>
        <p className="text-cyber-muted mb-6">查看服务器购买历史记录</p>
      </motion.div>

      {/* Filters and controls */}
      <div className="cyber-panel p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyber-muted">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cyber-input pl-10 w-full"
            />
          </div>
          
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "success" | "failed")}
              className="cyber-input w-full"
            >
              <option value="all">所有状态</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
            </select>
          </div>
          
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => fetchHistory(true)}
              className="cyber-button text-xs flex items-center"
              disabled={isLoading || isRefreshing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mr-1 flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}>
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              <span className="min-w-[2.5rem]">刷新</span>
            </button>
            
            <button
              onClick={clearHistory}
              className="cyber-button text-xs flex items-center bg-red-900/30 border-red-700/40 text-red-300 hover:bg-red-800/40 hover:border-red-600/50 hover:text-red-200"
              disabled={isLoading || history.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              清空
            </button>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="cyber-panel overflow-hidden">
        {/* 只在首次加载时显示加载状态，刷新时保留列表 */}
        {isLoading && history.length === 0 ? (
          <div className="animate-pulse p-4">
            <div className="h-8 bg-cyber-grid/30 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-cyber-grid/50 rounded"></div>
              ))}
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyber-muted mx-auto mb-4">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p className="text-cyber-muted">没有找到购买历史记录</p>
          </div>
        ) : isMobile ? (
          /* 移动端：卡片布局 */
          <div className="p-2 space-y-3">
            {filteredHistory.map((item) => (
              <MobileOrderCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          /* 桌面端：表格布局 */
          <div>
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                <tr className="bg-cyber-grid/30 text-cyber-muted text-left text-xs">
                  <th className="px-3 py-2.5 text-left">服务器型号</th>
                  <th className="px-3 py-2.5 text-left">机房</th>
                  <th className="px-3 py-2.5 text-left">配置选项</th>
                  <th className="px-3 py-2.5 text-left">价格</th>
                  <th className="px-3 py-2.5 text-left">状态</th>
                  <th className="px-3 py-2.5 text-left">购买时间</th>
                  <th className="px-3 py-2.5 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-grid/20">
                {filteredHistory.map((item) => (
                  <DesktopOrderRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
