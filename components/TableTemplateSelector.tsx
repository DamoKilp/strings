// components/TableTemplateSelector.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Search, Clock, Users, Star, Filter, X, Check, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  tableTemplates, 
  getTemplatesByCategory, 
  searchTemplates, 
  getTemplateCategories,
  getPopularTemplates,
  getRecommendedTemplates,
  type TableTemplate 
} from '@/utils/tableTemplates';

interface TableTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TableTemplate) => void;
  onCreateFromScratch: () => void;
}

const difficultyColors = {
  'Beginner': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Intermediate': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Advanced': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const categoryIcons = {
  'Business': '💼',
  'E-commerce': '🛒',
  'Project Management': '📊',
  'Analytics': '📈',
  'Asset Management': '🏗️',
  'System': '⚙️',
  'Custom': '🔧'
};

export default function TableTemplateSelector({
  isOpen,
  onClose,
  onSelectTemplate,
  onCreateFromScratch
}: TableTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<TableTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const categories = getTemplateCategories();
  const popularTemplates = getPopularTemplates(6);
  // Filter templates based on search and category, then sort alphabetically
  const filteredTemplates = useMemo(() => {
    let templates = searchQuery ? searchTemplates(searchQuery) : tableTemplates;
    
    if (selectedCategory !== 'All') {
      templates = templates.filter(template => template.category === selectedCategory);
    }
    
    // Sort templates alphabetically by displayName
    return templates.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [searchQuery, selectedCategory]);

  const handleTemplateSelect = (template: TableTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleConfirmSelection = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  const TemplateCard = ({ template }: { template: TableTemplate }) => (
    <Card 
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-blue-200 dark:hover:border-blue-700"
      onClick={() => handleTemplateSelect(template)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{template.icon}</div>
            <div>
              <CardTitle className="text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {template.displayName}
              </CardTitle>
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs ${difficultyColors[template.difficulty]}`}
          >
            {template.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {template.estimatedSetupTime}
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {template.columns.length} fields
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 3} more
              </Badge>
            )}
          </div>
          
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              Perfect for: {template.useCases.slice(0, 2).join(', ')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const TemplatePreview = ({ template }: { template: TableTemplate }) => (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="text-3xl">{template.icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{template.displayName}</h3>
          <p className="text-muted-foreground mt-1">{template.description}</p>
          <div className="flex items-center gap-4 mt-3">
            <Badge className={difficultyColors[template.difficulty]}>
              {template.difficulty}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {template.estimatedSetupTime}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" />
            Key Features
          </h4>
          <ul className="space-y-2">
            {template.features.map((feature, index) => (
              <li key={index} className="text-sm flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Use Cases
          </h4>
          <ul className="space-y-2">
            {template.useCases.map((useCase, index) => (
              <li key={index} className="text-sm flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-blue-500" />
                {useCase}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-3">Table Structure ({template.columns.length} fields)</h4>
        <ScrollArea className="h-32">
          <div className="space-y-2">
            {template.columns.map((column, index) => (
              <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                <div>
                  <span className="font-medium">{column.display_name}</span>
                  <span className="text-muted-foreground ml-2">({column.name})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{column.type}</Badge>
                  {!column.nullable && <Badge variant="secondary" className="text-xs">Required</Badge>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );

  if (showPreview && selectedTemplate) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Template Preview</DialogTitle>
                <DialogDescription>
                  Review the template details before creating your table
                </DialogDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPreview(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <TemplatePreview template={selectedTemplate} />
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Back to Templates
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCreateFromScratch}>
                Create from Scratch Instead
              </Button>
              <Button onClick={handleConfirmSelection} className="bg-blue-600 hover:bg-blue-700">
                Use This Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Choose a Table Template
          </DialogTitle>
          <DialogDescription>
            Start with a professionally designed template or create from scratch
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'All' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('All')}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="hidden sm:inline-flex"
                >
                  {categoryIcons[category]} {category}
                </Button>
              ))}
            </div>
          </div>

          <Tabs defaultValue="browse" className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="browse">Browse All</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="categories">By Category</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No templates found matching your criteria.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredTemplates.map((template) => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="popular" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Most Popular Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    These templates are beginner-friendly and cover the most common use cases.
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {popularTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="categories" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">                  {categories.map((category) => {
                    const categoryTemplates = getTemplatesByCategory(category)
                      .sort((a, b) => a.displayName.localeCompare(b.displayName));
                    return (
                      <div key={category}>
                        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                          <span className="text-xl">{categoryIcons[category]}</span>
                          {category}
                          <Badge variant="secondary" className="ml-2">
                            {categoryTemplates.length}
                          </Badge>
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {categoryTemplates.slice(0, 4).map((template) => (
                            <TemplateCard key={template.id} template={template} />
                          ))}
                        </div>
                        {categoryTemplates.length > 4 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setSelectedCategory(category);
                              // Switch to browse tab
                              const tabs = document.querySelector('[role="tablist"]');
                              const browseTab = tabs?.querySelector('[value="browse"]') as HTMLElement;
                              browseTab?.click();
                            }}
                          >
                            View all {categoryTemplates.length} {category} templates →
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {filteredTemplates.length} templates available
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="outline" onClick={onCreateFromScratch}>
                Create from Scratch
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
