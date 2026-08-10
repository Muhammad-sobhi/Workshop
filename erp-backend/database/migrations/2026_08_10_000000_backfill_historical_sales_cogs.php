<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Revenue;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('revenues')) return;

        $historicalRevenues = Revenue::where(function ($q) {
            $q->where('category', 'like', '%مبيعات سابقة%')
              ->orWhere('revenue_number', 'like', 'HIST-%');
        })->get();

        foreach ($historicalRevenues as $rev) {
            if ($rev->description && preg_match('/\[COST:\s*(\d+(?:\.\d+)?)\]/i', $rev->description, $matches)) {
                $costVal = floatval($matches[1]);
                $rev->update(['cogs' => $costVal]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reversal needed
    }
};
