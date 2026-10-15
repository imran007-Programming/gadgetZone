import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { MAX_IMAGE_BYTES, imageOnlyFilter } from '../common/upload.js';
import { BrandsService } from './brands.service.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Active brands with product counts' })
  @ApiQuery({ name: 'category', required: false, description: 'Only brands with products in this category slug' })
  list(@Query('category') category?: string) {
    return this.brands.publicList(category?.trim() || undefined);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'One active brand for its storefront page' })
  findOne(@Param('slug') slug: string) {
    return this.brands.publicBySlug(slug);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/brands')
@Roles('ADMIN')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'All brands with product counts (admin)' })
  list() {
    return this.brands.list();
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a brand logo or cover image to Cloudinary (admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES }, fileFilter: imageOnlyFilter }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.brands.uploadLogo(file);
  }

  @Post()
  @ApiOperation({ summary: 'Create a brand (admin)' })
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a brand (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a brand; its products become unbranded (admin)' })
  remove(@Param('id') id: string) {
    return this.brands.remove(id);
  }
}
