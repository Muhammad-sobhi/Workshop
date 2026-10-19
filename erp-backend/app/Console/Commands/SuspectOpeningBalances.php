<?php

namespace App\Console\Commands;

use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\InventoryService;
use Illuminate\Console\Command;

/**
 * Read-only. Before the fix, saving a material/product edit form wrote the stock shown on the
 * form into the opening balance (Initial_Balance) — so an item that already had purchases or
 * consumption got that stock counted twice. This lists the items whose opening balance was
 * written or rewritten by an edit after other movements existed, with the likely extra quantity,
 * so they can be counted physically first.
 */
class SuspectOpeningBalances extends Command
{
    protected $signature = 'inventory:suspect-opening-balances';

    protected $description = 'List items whose opening balance was overwritten by an edit after purchases/consumption (stock may be inflated)';

    public function handle(): int
    {
        $openings = InventoryMovement::where('movement_type', 'Initial_Balance')
            ->where(fn ($q) => $q->where('reference_number', 'like', 'INIT-MAT-%')->orWhere('reference_number', 'like', 'INIT-PROD-%'))
            ->orderBy('id')
            ->get();

        $rows = [];
        foreach ($openings as $opening) {
            $col = $opening->material_id ? 'material_id' : 'product_id';
            $itemId = $opening->material_id ?? $opening->product_id;

            $others = InventoryMovement::where($col, $itemId)
                ->where('warehouse_id', $opening->warehouse_id)
                ->where('id', '!=', $opening->id);

            $firstOther = (clone $others)->orderBy('created_at')->value('created_at');
            if (!$firstOther) continue; // nothing else ever happened to it: opening balance is the whole story

            $createdLate = $opening->created_at > $firstOther;
            $rewritten   = $opening->updated_at && $opening->updated_at->gt($opening->created_at->copy()->addMinute())
                && $opening->updated_at > $firstOther;
            if (!$createdLate && !$rewritten) continue;

            // The edit set the opening balance to the stock shown on the form, which already included
            // these movements — so they are counted twice. Likely extra = their net at the edit time.
            $editAt = $rewritten ? $opening->updated_at : $opening->created_at;
            $net = 0.0;
            foreach ((clone $others)->where('created_at', '<=', $editAt)->get(['movement_type', 'quantity']) as $m) {
                if (in_array($m->movement_type, InventoryService::INCOMING_TYPES, true)
                    || ($m->movement_type === 'Stock_Adjustment' && $m->quantity > 0)) {
                    $net += (float) $m->quantity;
                } elseif (in_array($m->movement_type, InventoryService::OUTGOING_TYPES, true)) {
                    $net -= (float) $m->quantity;
                }
            }
            $extra = round(max(0.0, $net), 2);
            if ($extra <= 0) continue;

            $item = $opening->material_id ? Material::withTrashed()->find($itemId) : Product::withTrashed()->find($itemId);
            $current = InventoryService::getStock($opening->material_id ? 'material' : 'product', $itemId, $opening->warehouse_id);

            $rows[] = [
                $opening->material_id ? 'خامة' : 'منتج',
                $itemId,
                $item->name ?? '?',
                Warehouse::find($opening->warehouse_id)->name ?? $opening->warehouse_id,
                (float) $opening->quantity,
                $editAt->format('Y-m-d H:i'),
                $current,
                $extra,
                round(max(0.0, $current - $extra), 2),
            ];
        }

        if (empty($rows)) {
            $this->info('✔ No item had its opening balance overwritten after purchases or consumption.');
            return self::SUCCESS;
        }

        $this->warn(count($rows) . ' item(s) to count physically first:');
        $this->table(
            ['النوع', '#', 'الصنف', 'المستودع', 'رصيد أول المدة', 'تاريخ التعديل', 'الرصيد الحالي', 'زيادة محتملة', 'الرصيد المتوقع'],
            $rows
        );
        $this->line('"زيادة محتملة" تقدير: لو كنت غيّرت رقم المخزون عمداً وقت التعديل فالرقم ده مش زيادة. الجرد الفعلي هو المرجع.');

        return self::SUCCESS;
    }
}
