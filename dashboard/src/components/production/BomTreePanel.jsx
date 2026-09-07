'use client';

/**
 * BUG-1 Fix: BomTreePanel
 *
 * Displays the full recursive Bill-of-Materials tree for a given operation,
 * fetched from GET /api/operations/{id}/bom-tree.
 *
 * Also works in "preview" mode for a product before an operation is created:
 * provide `product` and `quantity` props and it computes tree on-the-fly
 * from the product's materials / bomItems already loaded.
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Package, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

// Recursive tree node
function BomNode({ node, qty = 1, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const needed   = (node.qty_per_parent || 1) * qty;
  const stock    = node.stock ?? 0;
  const isShort  = stock < needed;
  const hasKids  = node.children && node.children.length > 0;
  const isSubProd = node.type === 'sub_product';

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
          isShort ? 'bg-red-500/10 border border-red-500/25' : 'bg-[#231B3D] border border-white/5'
        } hover:bg-white/5`}
        style={{ marginRight: `${depth * 16}px` }}
        onClick={() => hasKids && setOpen(o => !o)}
      >
        <span className="text-[#A49EC0] w-3.5 h-3.5 shrink-0">
          {hasKids ? (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
        </span>
        {isSubProd
          ? <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          : <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        <span className="text-xs text-white font-medium flex-1 truncate">{node.name}</span>
        <span className="text-[11px] font-mono text-[#A49EC0] shrink-0">
          x{needed} {node.unit}
        </span>
        <span className={`text-[11px] font-bold shrink-0 flex items-center gap-0.5 ${isShort ? 'text-red-400' : 'text-emerald-400'}`}>
          {isShort ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          {stock}
        </span>
      </div>
      {open && hasKids && (
        <div className="mt-1 space-y-1">
          {node.children.map((child, idx) => (
            <BomNode key={idx} node={child} qty={needed} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BomTreePanel({ operationId, product, quantity = 1 }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildLocalTree = useCallback((prod) => {
    if (!prod) return [];
    const nodes = [];
    const bomItems = prod.bom_items || prod.bomItems || [];
    bomItems.forEach(line => {
      if (line.sub_product) {
        nodes.push({
          type: 'sub_product', id: line.sub_product.id, name: line.sub_product.name,
          sku: line.sub_product.sku, unit: line.sub_product.unit ?? 'piece',
          qty_per_parent: parseFloat(line.quantity) || 1,
          stock: parseFloat(line.sub_product.stock_quantity ?? 0),
          unit_cost: parseFloat(line.sub_product.unit_cost ?? 0),
          children: buildLocalTree(line.sub_product),
        });
      }
    });
    (prod.materials || []).forEach(mat => {
      if (mat.type === 'service') return;
      nodes.push({
        type: 'material', id: mat.id, name: mat.name, sku: mat.sku, unit: mat.unit,
        qty_per_parent: parseFloat(mat.pivot?.quantity ?? 1),
        stock: parseFloat(mat.stock_quantity ?? 0),
        unit_cost: parseFloat(mat.unit_cost ?? 0),
        children: [],
      });
    });
    return nodes;
  }, []);

  useEffect(() => {
    if (operationId) {
      setLoading(true);
      apiClient.get(`/operations/${operationId}/bom-tree`)
        .then(res => { setTree(res.data.bom_tree || []); setError(null); })
        .catch(() => setError('Failed to load BOM tree'))
        .finally(() => setLoading(false));
    } else if (product) {
      setTree([{
        product_id: product.id, name: product.name, sku: product.sku,
        unit: product.unit ?? 'piece', quantity: parseFloat(quantity) || 1,
        stock: parseFloat(product.stock_quantity ?? product.stock_wshp ?? 0),
        bom: buildLocalTree(product),
      }]);
    }
  }, [operationId, product, quantity, buildLocalTree]);

  if (loading) return <div className="text-center py-4 text-xs text-[#A49EC0] animate-pulse">جاري تحميل شجرة المكونات (BOM)...</div>;
  if (error) return <div className="text-center py-3 text-xs text-red-400">{error}</div>;
  if (!tree || tree.length === 0) return null;

  return (
    <div className="space-y-3">
      {tree.map((productEntry, i) => (
        <div key={i} className="rounded-2xl border border-[#3D3554] bg-[#1E1635] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#2F264C] border-b border-[#3D3554]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ECC796]" />
              <span className="text-sm font-bold text-white">{productEntry.name}</span>
              <span className="text-xs text-[#A49EC0]">× {productEntry.quantity}</span>
            </div>
            <span className="text-xs text-[#A49EC0]">
              المخزون الجاهز: <span className="font-bold text-emerald-400">{productEntry.stock}</span>
            </span>
          </div>
          {(productEntry.bom || []).length > 0 ? (
            <div className="p-3 space-y-1">
              {(productEntry.bom || []).map((node, ni) => (
                <BomNode key={ni} node={node} qty={productEntry.quantity} depth={0} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-[#A49EC0] text-center">لا توجد مكونات أو مواد مسجلة في شجرة المنتج</div>
          )}
        </div>
      ))}
    </div>
  );
}
