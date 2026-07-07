<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Update users table
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->after('password');
            $table->json('permissions')->nullable()->after('role');
        });

        // 2. Update materials table
        Schema::table('materials', function (Blueprint $table) {
            $table->decimal('dimension', 15, 2)->nullable()->after('unit');
            $table->string('type')->default('material')->after('dimension'); // 'material' or 'service'
        });

        // 3. Update products table
        Schema::table('products', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('description');
        });

        // 4. Create measurement_units table
        Schema::create('measurement_units', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('type')->default('general'); // e.g. weight, length, quantity, volume
            $table->timestamps();
        });

        // 5. Create settings table
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // 6. Create notifications table
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('measurement_units');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });

        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn(['dimension', 'type']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'permissions']);
        });
    }
};
